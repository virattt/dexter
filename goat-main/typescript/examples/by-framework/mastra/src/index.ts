import readline from "node:readline";

import { mastra } from "./mastra";

(async () => {
    // 1. Import the agent
    const agent = mastra.getAgent("moneyTransmitter");

    // 2. Create a readline interface to interact with the agent
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const prompt = await new Promise<string>((resolve) => {
            rl.question('Enter your prompt (or "exit" to quit): ', resolve);
        });

        if (prompt === "exit") {
            rl.close();
            break;
        }

        console.log("\n-------------------\n");
        console.log("TOOLS CALLED");
        console.log("\n-------------------\n");
        try {
            // 3. Generate a response
            const result = await agent.generate(prompt, {
                onStepFinish: (step: string) => {
                    const parsedStep = JSON.parse(step);
                    console.log(parsedStep.toolCalls);
                },
            });

            console.log("\n-------------------\n");
            console.log("RESPONSE");
            console.log("\n-------------------\n");
            console.log(result.text);
        } catch (error) {
            console.error(error);
        }
        console.log("\n-------------------\n");
    }
})();
