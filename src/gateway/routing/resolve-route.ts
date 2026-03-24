import type { GatewayConfig } from '../config.js';

export type RoutePeer = {
  kind: 'direct' | 'group';
  id: string;
};

export type ResolvedRoute = {
  agentId: string;
  channel: string;
  accountId: string;
  sessionKey: string;
  mainSessionKey: string;
  matchedBy: 'binding.peer' | 'binding.account' | 'binding.channel' | 'default';
};

const DEFAULT_AGENT_ID = 'default';
const DEFAULT_ACCOUNT_ID = 'default';

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function buildSessionKey(params: {
  agentId: string;
  channel: string;
  accountId: string;
  peer?: RoutePeer | null;
}): string {
  const channel = normalizeToken(params.channel);
  const accountId = params.accountId.trim() || DEFAULT_ACCOUNT_ID;
  if (!params.peer) {
    return `agent:${params.agentId}:main`;
  }
  const peerKind = params.peer.kind;
  const peerId = params.peer.id.trim().toLowerCase();
  return `agent:${params.agentId}:${channel}:${accountId}:${peerKind}:${peerId}`;
}

export function resolveRoute(input: {
  cfg: GatewayConfig;
  channel: string;
  accountId?: string | null;
  peer?: RoutePeer | null;
}): ResolvedRoute {
  const channel = normalizeToken(input.channel);
  const accountId = (input.accountId ?? DEFAULT_ACCOUNT_ID).trim() || DEFAULT_ACCOUNT_ID;
  const peer = input.peer ? { kind: input.peer.kind, id: input.peer.id.trim() } : null;

  const bindings = input.cfg.bindings.filter((binding) => {
    if (normalizeToken(binding.match.channel) !== channel) {
      return false;
    }
    if (binding.match.accountId && binding.match.accountId !== '*' && binding.match.accountId !== accountId) {
      return false;
    }
    return true;
  });

  if (peer) {
    const peerMatch = bindings.find(
      (binding) => binding.match.peerKind === peer.kind && binding.match.peerId === peer.id,
    );
    if (peerMatch) {
      const agentId = peerMatch.agentId.trim() || DEFAULT_AGENT_ID;
      return {
        agentId,
        channel,
        accountId,
        sessionKey: buildSessionKey({ agentId, channel, accountId, peer }),
        mainSessionKey: buildSessionKey({ agentId, channel, accountId, peer: null }),
        matchedBy: 'binding.peer',
      };
    }
  }

  const accountMatch = bindings.find(
    (binding) => Boolean(binding.match.accountId) && !binding.match.peerId,
  );
  if (accountMatch) {
    const agentId = accountMatch.agentId.trim() || DEFAULT_AGENT_ID;
    return {
      agentId,
      channel,
      accountId,
      sessionKey: buildSessionKey({ agentId, channel, accountId, peer }),
      mainSessionKey: buildSessionKey({ agentId, channel, accountId, peer: null }),
      matchedBy: 'binding.account',
    };
  }

  const channelMatch = bindings.find((binding) => !binding.match.accountId && !binding.match.peerId);
  if (channelMatch) {
    const agentId = channelMatch.agentId.trim() || DEFAULT_AGENT_ID;
    return {
      agentId,
      channel,
      accountId,
      sessionKey: buildSessionKey({ agentId, channel, accountId, peer }),
      mainSessionKey: buildSessionKey({ agentId, channel, accountId, peer: null }),
      matchedBy: 'binding.channel',
    };
  }

  return {
    agentId: DEFAULT_AGENT_ID,
    channel,
    accountId,
    sessionKey: buildSessionKey({ agentId: DEFAULT_AGENT_ID, channel, accountId, peer }),
    mainSessionKey: buildSessionKey({
      agentId: DEFAULT_AGENT_ID,
      channel,
      accountId,
      peer: null,
    }),
    matchedBy: 'default',
  };
}

