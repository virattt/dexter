import { createChannelManager } from './channels/manager.js';
import { createWhatsAppPlugin } from './channels/whatsapp/plugin.js';
import {
  assertOutboundAllowed,
  sendComposing,
  sendMessageWhatsApp,
  type WhatsAppInboundMessage,
} from './channels/whatsapp/index.js';
import { resolveRoute } from './routing/resolve-route.js';
import { resolveSessionStorePath, upsertSessionMeta } from './sessions/store.js';
import { loadGatewayConfig, type GatewayConfig } from './config.js';
import { runAgentForMessage } from './agent-runner.js';
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_PATH = join(homedir(), '.dexter', 'gateway-debug.log');
function debugLog(msg: string) {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
}

export type GatewayService = {
  stop: () => Promise<void>;
  snapshot: () => Record<string, { accountId: string; running: boolean; connected?: boolean }>;
};

function elide(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Clean up markdown for WhatsApp compatibility.
 * - Converts `**text**` (markdown bold) to `*text*` (WhatsApp bold)
 * - Merges adjacent bold sections to prevent literal asterisks showing
 */
function cleanMarkdownForWhatsApp(text: string): string {
  let result = text;
  // Convert markdown bold (**text**) to WhatsApp bold (*text*)
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // Merge adjacent bold sections: `*foo* *bar*` -> `*foo bar*`
  result = result.replace(/\*([^*]+)\*\s+\*([^*]+)\*/g, '*$1 $2*');
  return result;
}

async function handleInbound(cfg: GatewayConfig, inbound: WhatsAppInboundMessage): Promise<void> {
  const bodyPreview = elide(inbound.body.replace(/\n/g, ' '), 50);
  console.log(`Inbound message ${inbound.from} (${inbound.chatType}, ${inbound.body.length} chars): "${bodyPreview}"`);
  debugLog(`[gateway] handleInbound from=${inbound.from} body="${inbound.body.slice(0, 30)}..."`);
  
  const route = resolveRoute({
    cfg,
    channel: 'whatsapp',
    accountId: inbound.accountId,
    peer: { kind: inbound.chatType, id: inbound.senderId },
  });

  const storePath = resolveSessionStorePath(route.agentId);
  upsertSessionMeta({
    storePath,
    sessionKey: route.sessionKey,
    channel: 'whatsapp',
    to: inbound.from,
    accountId: route.accountId,
    agentId: route.agentId,
  });

  // Start typing indicator loop to keep it alive during long agent runs
  const TYPING_INTERVAL_MS = 5000; // Refresh every 5 seconds
  let typingTimer: ReturnType<typeof setInterval> | undefined;
  
  const startTypingLoop = async () => {
    await sendComposing({ to: inbound.replyToJid, accountId: inbound.accountId });
    typingTimer = setInterval(() => {
      void sendComposing({ to: inbound.replyToJid, accountId: inbound.accountId });
    }, TYPING_INTERVAL_MS);
  };
  
  const stopTypingLoop = () => {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = undefined;
    }
  };

  try {
    // Defense-in-depth: verify outbound destination is allowed before any messaging
    try {
      assertOutboundAllowed({ to: inbound.replyToJid, accountId: inbound.accountId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      debugLog(`[gateway] outbound BLOCKED: ${msg}`);
      console.log(msg);
      return;
    }

    await startTypingLoop();
    console.log(`Processing message with agent...`);
    debugLog(`[gateway] running agent for session=${route.sessionKey}`);
    const startedAt = Date.now();
    const answer = await runAgentForMessage({
      sessionKey: route.sessionKey,
      query: inbound.body,
      model: 'gpt-5.2',
      modelProvider: 'openai',
    });
    const durationMs = Date.now() - startedAt;
    debugLog(`[gateway] agent answer length=${answer.length}`);
    
    // Stop typing loop before sending reply
    stopTypingLoop();

    if (answer.trim()) {
      // Clean up markdown for WhatsApp and reply
      const cleanedAnswer = cleanMarkdownForWhatsApp(answer);
      debugLog(`[gateway] sending reply to ${inbound.replyToJid}`);
      await sendMessageWhatsApp({
        to: inbound.replyToJid,
        body: `[Dexter] ${cleanedAnswer}`,
        accountId: inbound.accountId,
      });
      console.log(`Sent reply (${answer.length} chars, ${durationMs}ms)`);
      debugLog(`[gateway] reply sent`);
    } else {
      console.log(`Agent returned empty response (${durationMs}ms)`);
      debugLog(`[gateway] empty answer, not sending`);
    }
  } catch (err) {
    stopTypingLoop();
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`Error: ${msg}`);
    debugLog(`[gateway] ERROR: ${msg}`);
  }
}

export async function startGateway(params: { configPath?: string } = {}): Promise<GatewayService> {
  const cfg = loadGatewayConfig(params.configPath);
  const plugin = createWhatsAppPlugin({
    loadConfig: () => loadGatewayConfig(params.configPath),
    onMessage: async (inbound) => {
      const current = loadGatewayConfig(params.configPath);
      await handleInbound(current, inbound);
    },
  });
  const manager = createChannelManager({
    plugin,
    loadConfig: () => loadGatewayConfig(params.configPath),
  });
  await manager.startAll();

  return {
    stop: async () => {
      await manager.stopAll();
    },
    snapshot: () => manager.getSnapshot(),
  };
}

