import type { ChannelPlugin, ChannelRuntimeSnapshot } from './types.js';

type RuntimeStore = {
  aborts: Map<string, AbortController>;
  tasks: Map<string, Promise<unknown>>;
  runtimes: Map<string, ChannelRuntimeSnapshot>;
};

export type ChannelManager<TConfig, TAccount> = {
  startAll: () => Promise<void>;
  startAccount: (accountId: string) => Promise<void>;
  stopAccount: (accountId: string) => Promise<void>;
  stopAll: () => Promise<void>;
  getSnapshot: () => Record<string, ChannelRuntimeSnapshot>;
};

function createRuntimeStore(): RuntimeStore {
  return {
    aborts: new Map(),
    tasks: new Map(),
    runtimes: new Map(),
  };
}

export function createChannelManager<TConfig, TAccount>(params: {
  plugin: ChannelPlugin<TConfig, TAccount>;
  loadConfig: () => TConfig;
}): ChannelManager<TConfig, TAccount> {
  const { plugin, loadConfig } = params;
  const store = createRuntimeStore();

  const resolveRuntime = (accountId: string): ChannelRuntimeSnapshot =>
    store.runtimes.get(accountId) ?? {
      accountId,
      running: false,
      ...(plugin.status?.defaultRuntime ?? {}),
    };

  const setRuntime = (
    accountId: string,
    next: Partial<ChannelRuntimeSnapshot>,
  ): ChannelRuntimeSnapshot => {
    const current = resolveRuntime(accountId);
    const merged = { ...current, ...next, accountId };
    store.runtimes.set(accountId, merged);
    return merged;
  };

  const startAccount = async (accountId: string): Promise<void> => {
    if (store.tasks.has(accountId)) {
      return;
    }

    const cfg = loadConfig();
    const account = plugin.config.resolveAccount(cfg, accountId);
    if (plugin.config.isEnabled?.(account, cfg) === false) {
      setRuntime(accountId, { running: false, lastError: 'disabled' });
      return;
    }
    if ((await plugin.config.isConfigured?.(account, cfg)) === false) {
      setRuntime(accountId, { running: false, lastError: 'not configured' });
      return;
    }

    const abort = new AbortController();
    store.aborts.set(accountId, abort);
    setRuntime(accountId, {
      running: true,
      lastError: null,
      lastStartAt: Date.now(),
    });

    const task = Promise.resolve(
      plugin.gateway.startAccount({
        accountId,
        account,
        abortSignal: abort.signal,
        getStatus: () => resolveRuntime(accountId),
        setStatus: (patch) => setRuntime(accountId, patch),
      }),
    )
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setRuntime(accountId, { running: false, lastError: message });
      })
      .finally(() => {
        store.aborts.delete(accountId);
        store.tasks.delete(accountId);
        setRuntime(accountId, { running: false, lastStopAt: Date.now() });
      });
    store.tasks.set(accountId, task);
  };

  const stopAccount = async (accountId: string): Promise<void> => {
    const abort = store.aborts.get(accountId);
    const task = store.tasks.get(accountId);
    abort?.abort();
    if (plugin.gateway.stopAccount) {
      const cfg = loadConfig();
      const account = plugin.config.resolveAccount(cfg, accountId);
      await plugin.gateway.stopAccount({
        accountId,
        account,
        abortSignal: abort?.signal ?? new AbortController().signal,
        getStatus: () => resolveRuntime(accountId),
        setStatus: (patch) => setRuntime(accountId, patch),
      });
    }
    if (task) {
      await task.catch(() => undefined);
    }
  };

  const startAll = async (): Promise<void> => {
    const ids = plugin.config.listAccountIds(loadConfig());
    for (const id of ids) {
      await startAccount(id);
    }
  };

  const stopAll = async (): Promise<void> => {
    const ids = new Set([
      ...plugin.config.listAccountIds(loadConfig()),
      ...store.tasks.keys(),
      ...store.aborts.keys(),
    ]);
    for (const id of ids) {
      await stopAccount(id);
    }
  };

  const getSnapshot = (): Record<string, ChannelRuntimeSnapshot> => {
    const ids = new Set([
      ...plugin.config.listAccountIds(loadConfig()),
      ...store.runtimes.keys(),
      ...store.tasks.keys(),
    ]);
    const snapshot: Record<string, ChannelRuntimeSnapshot> = {};
    for (const id of ids) {
      snapshot[id] = resolveRuntime(id);
    }
    return snapshot;
  };

  return {
    startAll,
    startAccount,
    stopAccount,
    stopAll,
    getSnapshot,
  };
}

