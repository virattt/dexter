import { fetch } from 'bun';

async function testWebApp() {
    console.log("🚀 Testing Web App API (http://localhost:3000/api/chat)...");

    const payload = {
        query: "What is the price of Reliance Industries? (Test from script)",
        model: "gemini-3-flash-preview",
        provider: "google",
        // Not sending apiKeys, should fall back to server .env
    };

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`❌ Server Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        console.log("✅ Connection Established. Receiving Stream...");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No reader");

        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    try {
                        const event = JSON.parse(dataStr);
                        if (event.type === 'answer_chunk') {
                            process.stdout.write(event.text); // Stream output to console
                            fullText += event.text;
                        } else if (event.type === 'tool_start') {
                            console.log(`\n[Tool Start: ${event.tool}]`);
                        } else if (event.type === 'thinking') {
                            console.log(`\n[Thinking: ${event.message}]`);
                        } else if (event.type === 'tool_end') {
                            console.log(`[Tool End: ${event.tool}]`);
                        } else if (event.type === 'error') {
                            console.error(`\n❌ API Error: ${event.error}`);
                        }
                    } catch (e) {
                        // ignore parse errors for keepalives
                    }
                }
            }
        }

        console.log("\n\n✅ Test Complete!");
        if (fullText.length > 0) {
            console.log("Final Validation: Received Answer Content.");
        } else {
            console.log("⚠️ Warning: Received no text content.");
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

testWebApp();
