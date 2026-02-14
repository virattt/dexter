

// Helper function to get required environment variable
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Please set it in your .env file. See env.example for reference.`
    );
  }
  return value;
}

// Azure OpenAI configuration loaded from environment variables
// All values are required - no fallback defaults
export const AZURE_OPENAI_ENDPOINT = getRequiredEnv('AZURE_OPENAI_ENDPOINT');
export const AZURE_OPENAI_DEPLOYMENT = getRequiredEnv('AZURE_OPENAI_DEPLOYMENT');
export const AZURE_OPENAI_API_VERSION = getRequiredEnv('AZURE_OPENAI_API_VERSION');
export const AZURE_OPENAI_SCOPE = getRequiredEnv('AZURE_OPENAI_SCOPE');
export const AZURE_OPENAI_MANAGED_IDENTITY_CLIENT_ID = getRequiredEnv('AZURE_OPENAI_MANAGED_IDENTITY_CLIENT_ID');



// Initialize the DefaultAzureCredential

// Default model configuration
export const AZURE_OPENAI_DEFAULT_MODEL_ID = "gpt-5.2";
export const AZURE_OPENAI_DEFAULT_MODEL_REF = `azureopenai/${AZURE_OPENAI_DEFAULT_MODEL_ID}`;

export const AZURE_OPENAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const AZURE_OPENAI_MODEL_CATALOG = [
  {
    id: AZURE_OPENAI_DEFAULT_MODEL_ID,
    name: "GPT-5.2",
    reasoning: false,
    input: ["text", "image"] as const,
    contextWindow: 128000,
    maxTokens: 8192,
  },
] as const;

export type AzureOpenAICatalogEntry = (typeof AZURE_OPENAI_MODEL_CATALOG)[number];


