export function normalizeE164(number: string): string {
  const withoutPrefix = number.replace(/^whatsapp:/, '').trim();
  const digits = withoutPrefix.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return `+${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export function isSelfChatMode(
  selfE164: string | null | undefined,
  allowFrom?: Array<string | number> | null,
): boolean {
  if (!selfE164) {
    return false;
  }
  if (!Array.isArray(allowFrom) || allowFrom.length === 0) {
    return false;
  }
  const normalizedSelf = normalizeE164(selfE164);
  return allowFrom.some((value) => {
    if (value === '*') {
      return false;
    }
    try {
      return normalizeE164(String(value)) === normalizedSelf;
    } catch {
      return false;
    }
  });
}

/**
 * Convert a phone number or JID to a WhatsApp JID suitable for sending messages.
 * 
 * - Strips 'whatsapp:' prefix if present
 * - For JIDs with @s.whatsapp.net, strips device suffix (e.g., :0)
 * - For group JIDs (@g.us), returns as-is
 * - Otherwise, normalizes as E.164 and converts to @s.whatsapp.net format
 */
export function toWhatsappJid(input: string): string {
  const clean = input.replace(/^whatsapp:/, '').trim();
  
  // Handle group JIDs - return as-is
  if (clean.endsWith('@g.us')) {
    return clean;
  }
  
  // Handle user JIDs with @s.whatsapp.net - strip device suffix if present
  if (clean.includes('@s.whatsapp.net')) {
    // Extract phone number, stripping device suffix like ":0"
    const atIndex = clean.indexOf('@');
    const localPart = clean.slice(0, atIndex);
    // Strip device suffix (e.g., "15551234567:0" -> "15551234567")
    const phone = localPart.includes(':') ? localPart.split(':')[0] : localPart;
    return `${phone}@s.whatsapp.net`;
  }
  
  // Handle other JIDs (like @lid) - return as-is
  if (clean.includes('@')) {
    return clean;
  }
  
  // Phone number - normalize and convert
  const digits = normalizeE164(clean).replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}
