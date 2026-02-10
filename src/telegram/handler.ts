import type { Context } from 'grammy';
import { Agent } from '../agent/agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { getToolDescription } from '../utils/tool-description.js';
import { getSetting } from '../utils/config.js';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '../model/llm.js';
import { getDefaultModelForProvider } from '../components/ModelSelector.js';
import { splitMessage } from './message-utils.js';

// Per-chat conversation history
const chatHistories = new Map<number, InMemoryChatHistory>();

// Per-chat busy guard to prevent interleaved processing
const busyChats = new Set<number>();

// Minimum interval between status message edits (ms)
const STATUS_EDIT_INTERVAL = 2000;

function resolveModel(): { model: string; provider: string } {
  const provider = getSetting('provider', DEFAULT_PROVIDER);
  const model = getSetting('modelId', null) ?? getDefaultModelForProvider(provider) ?? DEFAULT_MODEL;
  return { model, provider };
}

function getHistory(chatId: number, model: string): InMemoryChatHistory {
  let history = chatHistories.get(chatId);
  if (!history) {
    history = new InMemoryChatHistory(model);
    chatHistories.set(chatId, history);
  }
  return history;
}

export async function handleMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Busy guard — one query at a time per chat
  if (busyChats.has(chatId)) {
    await ctx.reply('Please wait for the current query to finish.');
    return;
  }

  busyChats.add(chatId);

  const { model, provider } = resolveModel();
  const history = getHistory(chatId, model);

  // Save the user query to history before processing
  history.saveUserQuery(text);

  // Send initial status message
  const statusMsg = await ctx.reply('Thinking...');
  let lastEditTime = Date.now();

  // Debounced status updater
  async function updateStatus(newText: string): Promise<void> {
    const now = Date.now();
    if (now - lastEditTime < STATUS_EDIT_INTERVAL) return;
    lastEditTime = now;
    try {
      await ctx.api.editMessageText(chatId!, statusMsg.message_id, newText);
    } catch {
      // Ignore edit errors (message not modified, etc.)
    }
  }

  try {
    const agent = Agent.create({ model, modelProvider: provider });
    let finalAnswer = '';

    for await (const event of agent.run(text, history)) {
      switch (event.type) {
        case 'thinking':
          await updateStatus('Thinking...');
          break;

        case 'tool_start':
          await updateStatus(`Using ${getToolDescription(event.tool, event.args)}...`);
          break;

        case 'tool_progress':
          await updateStatus(`${event.tool}: ${event.message}`);
          break;

        case 'tool_end':
          await updateStatus('Analyzing results...');
          break;

        case 'tool_error':
          await updateStatus('Encountered an error, retrying...');
          break;

        case 'answer_start':
          await updateStatus('Writing answer...');
          break;

        case 'done':
          finalAnswer = event.answer;
          break;
      }
    }

    // Delete the status message
    try {
      await ctx.api.deleteMessage(chatId, statusMsg.message_id);
    } catch {
      // Ignore delete errors
    }

    // Save the answer to history
    await history.saveAnswer(finalAnswer);

    // Send the final answer, chunked if necessary
    const chunks = splitMessage(finalAnswer || 'No answer was generated.');
    for (const chunk of chunks) {
      try {
        await ctx.reply(chunk, { parse_mode: 'Markdown' });
      } catch {
        // Markdown parse failed — fall back to plain text
        await ctx.reply(chunk);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `Error: ${errorMessage.slice(0, 4000)}`
      );
    } catch {
      await ctx.reply(`Error: ${errorMessage.slice(0, 4000)}`);
    }
  } finally {
    busyChats.delete(chatId);
  }
}
