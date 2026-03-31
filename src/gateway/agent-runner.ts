import { Agent } from '../agent/agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { createMessageQueue, type MessageQueue, type QueuePriority } from '../utils/message-queue.js';
import { HEARTBEAT_OK_TOKEN } from './heartbeat/suppression.js';
import type { AgentEvent } from '../agent/types.js';
import type { GroupContext } from '../agent/prompts.js';

type SessionState = {
  history: InMemoryChatHistory;
  tail: Promise<void>;
  queue: MessageQueue;
  isRunning: boolean;
};

const sessions = new Map<string, SessionState>();

function getSession(sessionKey: string, model: string): SessionState {
  const existing = sessions.get(sessionKey);
  if (existing) {
    return existing;
  }
  const created: SessionState = {
    history: new InMemoryChatHistory(model),
    tail: Promise.resolve(),
    queue: createMessageQueue(),
    isRunning: false,
  };
  sessions.set(sessionKey, created);
  return created;
}

/**
 * Check whether an agent is currently running for a given session.
 * Used by the gateway to decide whether to enqueue or start a new turn.
 */
export function isSessionRunning(sessionKey: string): boolean {
  return sessions.get(sessionKey)?.isRunning ?? false;
}

/**
 * Enqueue a message for a session whose agent is currently running.
 * The agent will drain the queue between tool rounds.
 */
export function enqueueForSession(
  sessionKey: string,
  model: string,
  text: string,
  priority: QueuePriority = 'next',
): void {
  const session = getSession(sessionKey, model);
  session.queue.enqueue({
    text,
    priority,
    enqueuedAt: Date.now(),
    source: `whatsapp:${sessionKey}`,
  });
}

export type AgentRunRequest = {
  sessionKey: string;
  query: string;
  model: string;
  modelProvider: string;
  maxIterations?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
  isHeartbeat?: boolean;
  /** Run without persistent session history or memory (minimal context, ~95% token savings). */
  isolatedSession?: boolean;
  channel?: string;
  groupContext?: GroupContext;
};

export async function runAgentForMessage(req: AgentRunRequest): Promise<string> {
  const isolated = req.isolatedSession ?? false;
  const session = isolated ? null : getSession(req.sessionKey, req.model);
  let finalAnswer = '';

  const run = async () => {
    if (session) {
      session.isRunning = true;
      session.history.saveUserQuery(req.query);
    }

    const agent = await Agent.create({
      model: req.model,
      modelProvider: req.modelProvider,
      maxIterations: req.maxIterations ?? 10,
      signal: req.signal,
      channel: req.channel,
      groupContext: req.groupContext,
      memoryEnabled: !isolated,
      messageQueue: session?.queue,
    });

    for await (const event of agent.run(req.query, session?.history)) {
      await req.onEvent?.(event);
      if (event.type === 'done') {
        finalAnswer = event.answer;
      }
    }

    // Post-run: drain any messages that arrived after the agent's last check
    if (session && !session.queue.isEmpty()) {
      const remaining = session.queue.dequeueAll();
      const mergedText = remaining.map(m => m.text).join('\n\n');
      session.history.saveUserQuery(mergedText);

      const followUp = await Agent.create({
        model: req.model,
        modelProvider: req.modelProvider,
        maxIterations: req.maxIterations ?? 10,
        signal: req.signal,
        channel: req.channel,
        groupContext: req.groupContext,
        memoryEnabled: !isolated,
        messageQueue: session.queue,
      });

      for await (const event of followUp.run(mergedText, session.history)) {
        await req.onEvent?.(event);
        if (event.type === 'done') {
          finalAnswer = event.answer;
        }
      }
    }

    if (finalAnswer && session) {
      await session.history.saveAnswer(finalAnswer);
    }

    // Prune HEARTBEAT_OK turns to avoid context pollution
    if (session && req.isHeartbeat && finalAnswer.trim().toUpperCase().includes(HEARTBEAT_OK_TOKEN)) {
      session.history.pruneLastTurn();
    }

    if (session) {
      session.isRunning = false;
    }
  };

  if (session) {
    // Serialize per-session turns while allowing cross-session concurrency.
    session.tail = session.tail.then(run, run);
    await session.tail;
  } else {
    await run();
  }
  return finalAnswer;
}
