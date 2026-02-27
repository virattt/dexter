import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { runAgent } from './agent/runner.js';
import { InMemoryChatHistory } from './utils/in-memory-chat-history.js';
import * as dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

app.use('/*', cors());

// API Endpoint for Chat
app.post('/api/chat', async (c) => {
    try {
        const body = await c.req.json();
        const { query, model, provider, apiKeys } = body;

        if (!query) {
            return c.json({ error: 'Query is required' }, 400);
        }

        // Set headers for streaming
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        const history = new InMemoryChatHistory(); // In a real app, load from DB

        // We use a ReadableStream to stream events to the client
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    const generator = runAgent(query, {
                        model: model || 'gpt-5.2',
                        modelProvider: provider || 'openai',
                        apiKeys: apiKeys, // Pass client-provided keys
                    }, history);

                    for await (const event of generator) {
                        const data = JSON.stringify(event);
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }

                    controller.close();
                } catch (error: any) {
                    const errorEvent = JSON.stringify({ type: 'error', error: error.message });
                    controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Serve frontend static files
app.use('/*', serveStatic({ root: './client/dist' }));

// Fallback for SPA routing (return index.html for unknown routes)
app.get('*', serveStatic({ path: './client/dist/index.html' }));

const port = 3000;
console.log(`Server is running on port ${port}`);

try {
    serve({
        fetch: app.fetch,
        port
    });
} catch (e: any) {
    console.error("FAILED TO START SERVER:", e);
    process.exit(1);
}
