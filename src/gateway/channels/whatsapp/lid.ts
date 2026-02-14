/**
 * LID (Linked ID) resolution utilities for WhatsApp.
 * 
 * WhatsApp uses LID JIDs for self-chat which don't have Signal sessions.
 * We need to resolve LID JIDs to phone number JIDs (@s.whatsapp.net) for replies.
 */

export type LidLookup = {
  getPNForLID?: (lid: string) => Promise<string | null>;
};

/**
 * Resolve a JID to a phone number JID suitable for sending messages.
 * 
 * - If already @s.whatsapp.net or @g.us, returns as-is
 * - If @lid, attempts resolution via lidLookup.getPNForLID()
 * - Returns null if resolution fails or jid is null/undefined
 */
export async function resolveJidToPhoneJid(
  jid: string | null | undefined,
  lidLookup?: LidLookup,
  debugLog?: (msg: string) => void,
): Promise<string | null> {
  const log = debugLog ?? (() => {});
  
  if (!jid) {
    log(`[lid] jid is null/undefined`);
    return null;
  }

  // If already a phone JID or group JID, return as-is
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
    log(`[lid] ${jid} is already a phone/group JID`);
    return jid;
  }

  // Try LID resolution
  if (jid.endsWith('@lid')) {
    log(`[lid] ${jid} is an LID JID, attempting resolution`);
    if (lidLookup?.getPNForLID) {
      try {
        const pnJid = await lidLookup.getPNForLID(jid);
        log(`[lid] getPNForLID returned: ${pnJid}`);
        if (pnJid) return pnJid;
      } catch (err) {
        log(`[lid] getPNForLID error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      log(`[lid] getPNForLID not available`);
    }
  } else {
    log(`[lid] ${jid} is not an LID JID (doesn't end with @lid)`);
  }

  return null;
}
