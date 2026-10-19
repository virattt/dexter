export type InboundContext = {
  channel: 'whatsapp' | 'telegram';
  accountId: string;
  from: string;
  to: string;
  chatType: 'direct' | 'group';
  body: string;
  senderName?: string;
  messageId?: string;
};

