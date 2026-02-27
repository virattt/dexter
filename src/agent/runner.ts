import { Agent } from './agent.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { AgentConfig, AgentEvent } from './types.js';

export async function* runAgent(
    query: string,
    config: AgentConfig = {},
    history?: InMemoryChatHistory
): AsyncGenerator<AgentEvent> {
    // Create agent instance
    const agent = await Agent.create(config);

    // Run the agent stream
    const stream = agent.run(query, history);

    for await (const event of stream) {
        yield event;
    }
}
