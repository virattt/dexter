/**
 * Bundled default AIHF graph template.
 *
 * Dexter owns this graph so we don't depend on AIHF's /flows endpoint.
 * 18 analyst nodes feed into a single portfolio_manager_dexter node.
 * The AIHF backend inserts its own risk_manager between analysts and PM.
 */

import type { AihfGraph, AihfGraphNode, AihfGraphEdge } from './types.js';

const ANALYST_IDS = [
  'aswath_damodaran',
  'ben_graham',
  'bill_ackman',
  'cathie_wood',
  'charlie_munger',
  'michael_burry',
  'mohnish_pabrai',
  'peter_lynch',
  'phil_fisher',
  'rakesh_jhunjhunwala',
  'stanley_druckenmiller',
  'warren_buffett',
  'technical_analyst',
  'fundamentals_analyst',
  'growth_analyst',
  'news_sentiment_analyst',
  'sentiment_analyst',
  'valuation_analyst',
] as const;

export type AnalystId = (typeof ANALYST_IDS)[number];

const PM_NODE_ID = 'portfolio_manager_dexter';

export function getAnalystIds(): readonly string[] {
  return ANALYST_IDS;
}

export function getPMNodeId(): string {
  return PM_NODE_ID;
}

export function getDefaultAihfGraph(): AihfGraph {
  const nodes: AihfGraphNode[] = [
    ...ANALYST_IDS.map((id) => ({ id, type: 'analyst' })),
    { id: PM_NODE_ID, type: 'portfolio_manager' },
  ];

  const edges: AihfGraphEdge[] = ANALYST_IDS.map((id) => ({
    from: id,
    to: PM_NODE_ID,
  }));

  return { nodes, edges };
}
