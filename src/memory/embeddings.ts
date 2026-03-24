import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { EmbeddingProviderId, MemoryEmbeddingClient } from './types.js';

const DEFAULT_OPENAI_MODEL = 'text-embedding-3-small';
const DEFAULT_GEMINI_MODEL = 'gemini-embedding-001';
const DEFAULT_OLLAMA_MODEL = 'nomic-embed-text';
const EMBEDDING_BATCH_SIZE = 64;

type ResolvedProvider = Exclude<EmbeddingProviderId, 'auto' | 'none'>;

function resolveProvider(preferred: EmbeddingProviderId): ResolvedProvider | null {
  if (preferred === 'openai' && process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  if (preferred === 'gemini' && process.env.GOOGLE_API_KEY) {
    return 'gemini';
  }
  if (preferred === 'ollama') {
    return 'ollama';
  }

  if (preferred === 'auto') {
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    if (process.env.GOOGLE_API_KEY) {
      return 'gemini';
    }
    if (process.env.OLLAMA_BASE_URL) {
      return 'ollama';
    }
  }

  return null;
}

async function embedInBatches(
  texts: string[],
  embedBatch: (batch: string[]) => Promise<number[][]>,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const result = await embedBatch(batch);
    vectors.push(...result);
  }
  return vectors;
}

export function createEmbeddingClient(params: {
  provider: EmbeddingProviderId;
  model?: string;
}): MemoryEmbeddingClient | null {
  const resolved = resolveProvider(params.provider);
  if (!resolved) {
    return null;
  }

  if (resolved === 'openai') {
    const model = params.model || DEFAULT_OPENAI_MODEL;
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model,
    });
    return {
      provider: 'openai',
      model,
      embed: async (texts: string[]) =>
        embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
    };
  }

  if (resolved === 'gemini') {
    const model = params.model || DEFAULT_GEMINI_MODEL;
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model,
    });
    return {
      provider: 'gemini',
      model,
      embed: async (texts: string[]) =>
        embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
    };
  }

  const model = params.model || DEFAULT_OLLAMA_MODEL;
  const embeddings = new OllamaEmbeddings({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model,
  });
  return {
    provider: 'ollama',
    model,
    embed: async (texts: string[]) =>
      embedInBatches(texts, async (batch) => embeddings.embedDocuments(batch)),
  };
}

export async function embedSingleQuery(
  client: MemoryEmbeddingClient | null,
  query: string,
): Promise<number[] | null> {
  if (!client) {
    return null;
  }
  const vectors = await client.embed([query]);
  return vectors[0] ?? null;
}
