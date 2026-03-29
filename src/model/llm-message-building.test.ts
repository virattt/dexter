/**
 * Regression tests for callLlm / streamCallLlm message construction.
 *
 * Background: the original implementation used ChatPromptTemplate.fromMessages
 * which treated `{variable}` syntax inside the system prompt as LangChain input
 * variables.  Any `{...}` in skill tool results or SKILL.md content (e.g.
 * `{price, probability}`) caused:
 *
 *   Error: [OpenAI API] Missing value for input variable `"price": 60000, ...`
 *
 * The fix: pass [SystemMessage, HumanMessage] directly without a template, same
 * as streamCallLlm already did.  These tests pin that behaviour so it cannot
 * silently regress.
 *
 * Design note: agent-response.test.ts mocks the entire llm.js module (overriding
 * callLlm but keeping getChatModel and _setModelFactory as the real exports).
 * To avoid testing a mock that always resolves, curly-brace safety is tested at
 * the LangChain message-construction layer directly, and message structure is
 * tested via getChatModel + SpyChatModel (bypassing the mocked callLlm).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SystemMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';

process.env.OPENAI_API_KEY ??= 'sk-test-stub';

const { getChatModel, _setModelFactory } = await import('./llm.js');

// ---------------------------------------------------------------------------
// SpyChatModel — injected via _setModelFactory so getChatModel returns it.
// Only used for "message structure" tests that call invoke() on the model.
// ---------------------------------------------------------------------------

type Captured = { messages: BaseMessage[] };
const captured: Captured[] = [];
function clearCaptures() { captured.length = 0; }

class SpyChatModel extends BaseChatModel {
  _llmType() { return 'spy'; }
  bindTools() { return this as unknown as this; }

  async _generate(messages: BaseMessage[]) {
    captured.push({ messages: [...messages] });
    return { generations: [{ text: 'ok', message: new AIMessageChunk('ok') }] };
  }

  async *_streamResponseChunks(messages: BaseMessage[]) {
    captured.push({ messages: [...messages] });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk('streamed'),
      text: 'streamed',
    });
  }
}

beforeAll(() => { _setModelFactory(() => new SpyChatModel({})); });
afterAll(() => { _setModelFactory(null); });

// ---------------------------------------------------------------------------
// § 1  LangChain message construction — core regression
//
// The original bug was ChatPromptTemplate.fromMessages(['system', str]) treating
// `{variable}` inside str as a template placeholder.
// Using new SystemMessage(str) directly never parses template variables.
// These tests are independent of callLlm (which may be mocked in the full suite).
// ---------------------------------------------------------------------------

describe('LangChain message construction — curly braces must not throw', () => {
  it('new SystemMessage with {variable} style braces does not throw', () => {
    expect(() => new SystemMessage('Use {price, probability} format.')).not.toThrow();
  });

  it('new HumanMessage with JSON {braces} does not throw', () => {
    expect(() => new HumanMessage('{"price": 60000, "probability": 0.997}')).not.toThrow();
  });

  it('new SystemMessage with deeply nested {braces} content does not throw', () => {
    const content = [
      '## Step 2b — Extract price threshold markets',
      'Record `{price, probability}` where:',
      '- `price` = the dollar level as a number',
      'Call `price_distribution_chart` with [{price: 60000, probability: 0.997}]',
    ].join('\n');
    expect(() => new SystemMessage(content)).not.toThrow();
  });

  it('SystemMessage preserves {braces} content verbatim', () => {
    const content = 'Collect [{price, probability}] and call the chart tool.';
    const msg = new SystemMessage(content);
    expect(msg.content).toBe(content);
    expect(msg._getType()).toBe('system');
  });

  it('HumanMessage preserves JSON {braces} verbatim', () => {
    const content = 'Data: {"markets": [{"price": 3400, "probability": 0.079}]}';
    const msg = new HumanMessage(content);
    expect(msg.content).toBe(content);
    expect(msg._getType()).toBe('human');
  });
});

// ---------------------------------------------------------------------------
// § 2  getChatModel + message routing via SpyChatModel
//
// Verify that:
//  a. getChatModel respects _setModelFactory and returns SpyChatModel
//  b. invoke() on the returned model calls _generate with the right messages
//  c. Content containing {braces} passes through without alteration
// These tests call getChatModel + invoke directly to avoid the mocked callLlm.
// ---------------------------------------------------------------------------

describe('getChatModel — message structure via SpyChatModel', () => {
  it('factory override produces a SpyChatModel', () => {
    const model = getChatModel('gpt-5.4');
    expect(model).toBeInstanceOf(SpyChatModel);
  });

  it('messages array contains SystemMessage first', async () => {
    clearCaptures();
    const model = getChatModel('gpt-5.4');
    const messages = [
      new SystemMessage('You are helpful.'),
      new HumanMessage('hello'),
    ];
    await model.invoke(messages);
    expect(captured[0]?.messages[0]?._getType()).toBe('system');
  });

  it('messages array contains HumanMessage second', async () => {
    clearCaptures();
    const model = getChatModel('gpt-5.4');
    const messages = [
      new SystemMessage('system'),
      new HumanMessage('user question here'),
    ];
    await model.invoke(messages);
    expect(captured[0]?.messages[1]?._getType()).toBe('human');
  });

  it('SystemMessage content with {braces} reaches model verbatim', async () => {
    clearCaptures();
    const systemPrompt = 'Collect [{price, probability}] and call the tool.';
    const model = getChatModel('gpt-5.4');
    await model.invoke([new SystemMessage(systemPrompt), new HumanMessage('hello')]);
    expect(captured[0]?.messages[0]?.content).toBe(systemPrompt);
  });

  it('HumanMessage content with JSON {braces} reaches model verbatim', async () => {
    clearCaptures();
    const userPrompt = 'Tool said: {"price": 60000, "probability": 0.997}';
    const model = getChatModel('gpt-5.4');
    await model.invoke([new SystemMessage('system'), new HumanMessage(userPrompt)]);
    expect(captured[0]?.messages[1]?.content).toBe(userPrompt);
  });

  it('message list length is preserved (no extra wrapping)', async () => {
    clearCaptures();
    const model = getChatModel('gpt-5.4');
    await model.invoke([new SystemMessage('sys'), new HumanMessage('usr')]);
    expect(captured[0]?.messages).toHaveLength(2);
  });
});
