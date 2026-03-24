import qrcode from 'qrcode-terminal';
import { createWaSocket, getStatusCode, waitForWaConnection } from './session.js';
import { formatError } from './error.js';

export type LoginResult = {
  phone: string | null;
};

function extractPhoneFromJid(jid: string | undefined): string | null {
  if (!jid) {
    return null;
  }
  // Format: "1234567890:123@s.whatsapp.net" -> "+1234567890"
  const match = jid.match(/^(\d+):/);
  return match ? `+${match[1]}` : null;
}

function getErrorStatusCode(err: unknown): number | undefined {
  return (
    (err as { error?: { output?: { statusCode?: number } } })?.error?.output?.statusCode ??
    getStatusCode(err)
  );
}

export async function loginWhatsApp(params: { authDir: string }): Promise<LoginResult> {
  let resolved = false;
  const sock = await createWaSocket({
    authDir: params.authDir,
    printQr: false,
    onQr: (qr) => {
      if (resolved) {
        return;
      }
      console.log('Scan this QR in WhatsApp -> Linked Devices:');
      qrcode.generate(qr, { small: true });
    },
  });

  try {
    await waitForWaConnection(sock);
    resolved = true;
    const phone = extractPhoneFromJid(sock.user?.id);
    console.log('WhatsApp linked successfully.');
    return { phone };
  } catch (err) {
    const code = getErrorStatusCode(err);

    // Handle 515 "restart required" - WhatsApp asks for reconnection after pairing
    if (code === 515) {
      console.log('WhatsApp asked for restart (code 515); credentials saved. Retrying connection...');
      try {
        sock.ws.close();
      } catch {
        // ignore
      }

      // Retry without QR - credentials are already saved from the first connection
      const retry = await createWaSocket({
        authDir: params.authDir,
        printQr: false,
      });

      try {
        await waitForWaConnection(retry);
        resolved = true;
        const phone = extractPhoneFromJid(retry.user?.id);
        console.log('WhatsApp linked successfully after restart.');
        return { phone };
      } finally {
        setTimeout(() => {
          try {
            retry.ws.close();
          } catch {
            // ignore
          }
        }, 500);
      }
    }

    // Other errors
    const formatted = formatError(err);
    console.error(`WhatsApp connection failed: ${formatted}`);
    throw new Error(formatted, { cause: err });
  } finally {
    setTimeout(() => {
      try {
        sock.ws.close();
      } catch {
        // ignore
      }
    }, 500);
  }
}

