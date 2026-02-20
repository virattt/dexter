import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import { mkdirSync } from 'node:fs';
import { createSilentLogger } from './logger.js';
import { maybeRestoreCredsFromBackup, backupCredsBeforeSave } from './auth-store.js';

export type WaSocket = ReturnType<typeof makeWASocket>;

export async function createWaSocket(params: {
  authDir: string;
  printQr: boolean;
  onQr?: (qr: string) => void;
  verbose?: boolean;
}): Promise<WaSocket> {
  mkdirSync(params.authDir, { recursive: true });

  // Restore credentials from backup if main creds.json is corrupted
  maybeRestoreCredsFromBackup(params.authDir);

  const { state, saveCreds } = await useMultiFileAuthState(params.authDir);
  const { version } = await fetchLatestBaileysVersion();
  const logger = createSilentLogger();
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    logger,
    printQRInTerminal: params.printQr,
    browser: ['dexter', 'cli', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  // Backup credentials before each save
  sock.ev.on('creds.update', () => {
    backupCredsBeforeSave(params.authDir);
    saveCreds();
  });
  sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
    if (update.qr) {
      params.onQr?.(update.qr);
    }
  });

  // Handle WebSocket-level errors to prevent unhandled exceptions
  if (sock.ws && typeof (sock.ws as unknown as { on?: unknown }).on === 'function') {
    sock.ws.on('error', () => {
      // Silently handle WebSocket errors - reconnection logic handles recovery
    });
  }

  return sock;
}

export async function waitForWaConnection(sock: WaSocket): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    const onUpdate = (update: Partial<ConnectionState>) => {
      if (update.connection === 'open') {
        sock.ev.off('connection.update', onUpdate);
        resolve();
      }
      if (update.connection === 'close') {
        sock.ev.off('connection.update', onUpdate);
        reject(update.lastDisconnect?.error ?? new Error('Connection closed'));
      }
    };
    sock.ev.on('connection.update', onUpdate);
  });
}

export function getStatusCode(error: unknown): number | undefined {
  return (
    (error as { output?: { statusCode?: number } })?.output?.statusCode ??
    (error as { status?: number })?.status
  );
}

export function isLoggedOutReason(error: unknown): boolean {
  return getStatusCode(error) === DisconnectReason.loggedOut;
}

