import { Agent } from '../agent/agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { AgentEvent } from '../agent/types.js';

type SessionState = {
  history: InMemoryChatHistory;
  tail: Promise<void>;
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
  };
  sessions.set(sessionKey, created);
  return created;
}

export type AgentRunRequest = {
  sessionKey: string;
  query: string;
  model: string;
  modelProvider: string;
  maxIterations?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
};

export async function runAgentForMessage(req: AgentRunRequest): Promise<string> {
  const session = getSession(req.sessionKey, req.model);
  let finalAnswer = '';

  const run = async () => {
    session.history.saveUserQuery(req.query);
    const agent = await Agent.create({
      model: req.model,
      modelProvider: req.modelProvider,
      maxIterations: req.maxIterations ?? 10,
      signal: req.signal,
    });
    for await (const event of agent.run(req.query, session.history)) {
      await req.onEvent?.(event);
      if (event.type === 'done') {
        finalAnswer = event.answer;
      }
    }
    if (finalAnswer) {
      await session.history.saveAnswer(finalAnswer);
    }
  };

  // Serialize per-session turns while allowing cross-session concurrency.
  session.tail = session.tail.then(run, run);
  await session.tail;
  return finalAnswer;
}

