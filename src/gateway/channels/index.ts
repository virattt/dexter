/**
 * Channel extension seam:
 * - Add a new channel plugin that implements ChannelPlugin<TConfig, TAccount>.
 * - Register it in gateway bootstrap alongside WhatsApp.
 * - Reuse the same manager lifecycle (start/stop/status) without changing core gateway flow.
 */
export * from './manager.js';
export * from './types.js';

