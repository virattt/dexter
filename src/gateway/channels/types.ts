export type ChannelId = 'whatsapp';

export type ChannelRuntimeSnapshot = {
  accountId: string;
  running: boolean;
  connected?: boolean;
  lastError?: string | null;
  lastStartAt?: number;
  lastStopAt?: number;
};

export type ChannelStartContext<TAccount> = {
  accountId: string;
  account: TAccount;
  abortSignal: AbortSignal;
  getStatus: () => ChannelRuntimeSnapshot;
  setStatus: (next: Partial<ChannelRuntimeSnapshot>) => ChannelRuntimeSnapshot;
};

export type ChannelStopContext<TAccount> = {
  accountId: string;
  account: TAccount;
  abortSignal: AbortSignal;
  getStatus: () => ChannelRuntimeSnapshot;
  setStatus: (next: Partial<ChannelRuntimeSnapshot>) => ChannelRuntimeSnapshot;
};

export type ChannelConfigAdapter<TConfig, TAccount> = {
  listAccountIds: (cfg: TConfig) => string[];
  resolveAccount: (cfg: TConfig, accountId: string) => TAccount;
  isEnabled?: (account: TAccount, cfg: TConfig) => boolean;
  isConfigured?: (account: TAccount, cfg: TConfig) => Promise<boolean> | boolean;
};

export type ChannelGatewayAdapter<TAccount> = {
  startAccount: (ctx: ChannelStartContext<TAccount>) => Promise<void>;
  stopAccount?: (ctx: ChannelStopContext<TAccount>) => Promise<void>;
};

export type ChannelPlugin<TConfig, TAccount> = {
  id: ChannelId;
  config: ChannelConfigAdapter<TConfig, TAccount>;
  gateway: ChannelGatewayAdapter<TAccount>;
  status?: {
    defaultRuntime?: ChannelRuntimeSnapshot;
  };
};

