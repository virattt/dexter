import { Agent } from '../agent/agent.js';

async function main() {
    console.log('Initializing Agent...');
    const agent = await Agent.create({
        model: 'gpt-4o-mini', // Try default or a known model
        maxIterations: 5,
    });

    console.log('Running query for PETR4...');
    const generator = agent.run('What is the current stock price of PETR4 in the Brazilian market?');

    for await (const event of generator) {
        if (event.type === 'thinking') {
            console.log('Thinking:', event.message);
        } else if (event.type === 'tool_start') {
            console.log('Calling tool:', event.tool, event.args);
        } else if (event.type === 'tool_end') {
            console.log('Tool result:', event.result);
        } else if (event.type === 'done') {
            console.log('Answer:', event.answer);
        }
    }
}

main().catch(console.error);
