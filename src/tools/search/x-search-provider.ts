export type XSearchProvider = 'official' | 'xquik';

export interface XTweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  urls: string[];
  tweet_url: string;
}

/** Prefer Dexter's existing official X API integration when both are set. */
export function getXSearchProvider(): XSearchProvider | undefined {
  if (process.env.X_BEARER_TOKEN) return 'official';
  if (process.env.XQUIK_API_KEY) return 'xquik';
  return undefined;
}

export function hasXSearchProvider(): boolean {
  return getXSearchProvider() !== undefined;
}
