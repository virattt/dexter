/**
 * Curated OSINT source registry.
 *
 * Maps specialist sources (news organisations, conflict trackers, OSINT researchers)
 * to Bluesky handles and web domains so the geopolitics_search tool knows where to
 * look. Users can extend this list without modifying the tool.
 *
 * Sources are free-tier: Bluesky public API + GDELT article indexing.
 * No X / Twitter credentials required.
 */

export type EventCategory =
  | 'ukraine-russia'
  | 'middle-east'
  | 'china-taiwan'
  | 'us-china-trade'
  | 'iran'
  | 'north-korea'
  | 'cyberattack'
  | 'sanctions'
  | 'election-risk'
  | 'energy-supply'
  | 'commodity-shock'
  | 'pandemic-risk'
  | 'general-conflict';

export type SourceReliability = 'high' | 'medium' | 'low';
export type SourceSpecialty =
  | 'conflict-military'
  | 'macro-geopolitical'
  | 'sanctions-trade'
  | 'breaking-news'
  | 'open-source-investigation'
  | 'financial-markets';

export interface OsintSource {
  name: string;
  /** Bluesky handle (if account exists), e.g. "bellingcat.bsky.social" */
  blueskyHandle?: string;
  /** Web / RSS domain for GDELT matching */
  webDomain?: string;
  specialty: SourceSpecialty;
  /** Which event categories this source typically covers */
  eventCategories: EventCategory[];
  reliability: SourceReliability;
}

export const OSINT_SOURCES: OsintSource[] = [
  // ── Breaking news ───────────────────────────────────────────────────────
  {
    name: 'Reuters',
    blueskyHandle: 'reuters.com',
    webDomain: 'reuters.com',
    specialty: 'breaking-news',
    eventCategories: ['ukraine-russia', 'middle-east', 'china-taiwan', 'us-china-trade', 'iran', 'sanctions'],
    reliability: 'high',
  },
  {
    name: 'Associated Press',
    blueskyHandle: 'apnews.com',
    webDomain: 'apnews.com',
    specialty: 'breaking-news',
    eventCategories: ['ukraine-russia', 'middle-east', 'general-conflict', 'election-risk'],
    reliability: 'high',
  },
  {
    name: 'BBC News',
    blueskyHandle: 'bbc.com',
    webDomain: 'bbc.com',
    specialty: 'breaking-news',
    eventCategories: ['ukraine-russia', 'middle-east', 'china-taiwan', 'general-conflict'],
    reliability: 'high',
  },
  {
    name: 'Financial Times',
    blueskyHandle: 'ft.com',
    webDomain: 'ft.com',
    specialty: 'financial-markets',
    eventCategories: ['us-china-trade', 'sanctions', 'energy-supply', 'election-risk'],
    reliability: 'high',
  },
  {
    name: 'The Guardian',
    blueskyHandle: 'theguardian.com',
    webDomain: 'theguardian.com',
    specialty: 'breaking-news',
    eventCategories: ['ukraine-russia', 'middle-east', 'general-conflict'],
    reliability: 'high',
  },

  // ── Conflict / military OSINT ────────────────────────────────────────────
  {
    name: 'Bellingcat',
    blueskyHandle: 'bellingcat.bsky.social',
    webDomain: 'bellingcat.com',
    specialty: 'open-source-investigation',
    eventCategories: ['ukraine-russia', 'middle-east', 'cyberattack', 'general-conflict'],
    reliability: 'high',
  },
  {
    name: 'Institute for the Study of War (ISW)',
    webDomain: 'understandingwar.org',
    specialty: 'conflict-military',
    eventCategories: ['ukraine-russia', 'middle-east', 'iran', 'north-korea'],
    reliability: 'high',
  },
  {
    name: 'Kyiv Independent',
    blueskyHandle: 'kyivindependent.com',
    webDomain: 'kyivindependent.com',
    specialty: 'conflict-military',
    eventCategories: ['ukraine-russia', 'sanctions'],
    reliability: 'high',
  },
  {
    name: 'Al Jazeera English',
    webDomain: 'aljazeera.com',
    specialty: 'breaking-news',
    eventCategories: ['middle-east', 'iran', 'general-conflict'],
    reliability: 'high',
  },
  {
    name: 'Defense One',
    webDomain: 'defenseone.com',
    specialty: 'conflict-military',
    eventCategories: ['ukraine-russia', 'middle-east', 'china-taiwan', 'north-korea', 'cyberattack'],
    reliability: 'high',
  },
  {
    name: 'War on the Rocks',
    webDomain: 'warontherocks.com',
    specialty: 'conflict-military',
    eventCategories: ['ukraine-russia', 'middle-east', 'china-taiwan', 'north-korea'],
    reliability: 'high',
  },

  // ── Macro / geopolitical analysis ────────────────────────────────────────
  {
    name: 'Foreign Policy',
    webDomain: 'foreignpolicy.com',
    specialty: 'macro-geopolitical',
    eventCategories: ['us-china-trade', 'iran', 'election-risk', 'sanctions'],
    reliability: 'high',
  },
  {
    name: 'Council on Foreign Relations',
    webDomain: 'cfr.org',
    specialty: 'macro-geopolitical',
    eventCategories: ['us-china-trade', 'middle-east', 'north-korea', 'election-risk'],
    reliability: 'high',
  },
  {
    name: 'RAND Corporation',
    webDomain: 'rand.org',
    specialty: 'macro-geopolitical',
    eventCategories: ['china-taiwan', 'north-korea', 'cyberattack', 'energy-supply'],
    reliability: 'high',
  },
  {
    name: 'CSIS (Center for Strategic & Int\'l Studies)',
    webDomain: 'csis.org',
    specialty: 'macro-geopolitical',
    eventCategories: ['china-taiwan', 'sanctions', 'energy-supply'],
    reliability: 'high',
  },

  // ── Sanctions / trade / regulatory ───────────────────────────────────────
  {
    name: 'OFAC / US Treasury',
    webDomain: 'home.treasury.gov',
    specialty: 'sanctions-trade',
    eventCategories: ['sanctions', 'iran', 'north-korea', 'ukraine-russia'],
    reliability: 'high',
  },
  {
    name: 'South China Morning Post',
    webDomain: 'scmp.com',
    specialty: 'macro-geopolitical',
    eventCategories: ['china-taiwan', 'us-china-trade'],
    reliability: 'medium',
  },
  {
    name: 'Axios',
    blueskyHandle: 'axios.bsky.social',
    webDomain: 'axios.com',
    specialty: 'breaking-news',
    eventCategories: ['us-china-trade', 'election-risk', 'sanctions', 'cyberattack'],
    reliability: 'high',
  },

  // ── Cyber / infrastructure ────────────────────────────────────────────────
  {
    name: 'Recorded Future / The Record',
    webDomain: 'therecord.media',
    specialty: 'open-source-investigation',
    eventCategories: ['cyberattack', 'sanctions'],
    reliability: 'high',
  },
  {
    name: 'Krebs on Security',
    webDomain: 'krebsonsecurity.com',
    specialty: 'open-source-investigation',
    eventCategories: ['cyberattack'],
    reliability: 'high',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Returns all sources relevant to the given event category. */
export function getSourcesByCategory(category: EventCategory): OsintSource[] {
  return OSINT_SOURCES.filter((s) => s.eventCategories.includes(category));
}

/** Returns all high-reliability sources. */
export function getHighReliabilitySources(): OsintSource[] {
  return OSINT_SOURCES.filter((s) => s.reliability === 'high');
}

/** Returns web domains from sources covering a given category (for GDELT domain filtering). */
export function getDomainsForCategory(category: EventCategory): string[] {
  return getSourcesByCategory(category)
    .filter((s) => s.webDomain !== undefined)
    .map((s) => s.webDomain as string);
}

/** Returns Bluesky handles from sources covering a given category. */
export function getBskyHandlesForCategory(category: EventCategory): string[] {
  return getSourcesByCategory(category)
    .filter((s) => s.blueskyHandle !== undefined)
    .map((s) => s.blueskyHandle as string);
}
