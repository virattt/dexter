export type TelegramInboundMessage = {
  accountId: string;
  chatId: string;
  chatType: 'direct' | 'group';
  from: string;
  senderId: string;
  senderName?: string;
  body: string;
  timestamp?: number;
  reply: (text: string) => Promise<void>;
  sendComposing: () => Promise<void>;
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string };
  from?: TelegramUser;
  text?: string;
  entities?: TelegramMessageEntity[];
  reply_to_message?: { from?: TelegramUser };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type TelegramApiResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};
