/**
 * Future channel extension points:
 *
 * 1. Implement a channel plugin that satisfies `ChannelPlugin<TConfig, TAccount>`.
 * 2. Provide inbound message normalization into gateway `InboundContext`.
 * 3. Reuse `resolveRoute()` + `runAgentForMessage()` without changing gateway orchestration.
 * 4. Register the plugin in gateway bootstrap next to WhatsApp.
 *
 * This keeps Layer 1 channel transport isolated from Dexter agent execution.
 */
export const GATEWAY_EXTENSION_POINTS = [
  'ChannelPlugin lifecycle (start/stop/status)',
  'InboundContext normalization',
  'Outbound delivery adapter',
  'Route/session metadata integration',
] as const;

