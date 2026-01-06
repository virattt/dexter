import { Laminar } from '@lmnr-ai/lmnr';

let initialized = false;

export function initializeLaminar(): void {
  if (initialized) return;

  const projectApiKey = process.env.LMNR_PROJECT_API_KEY?.trim();
  if (!projectApiKey || projectApiKey.startsWith('your-')) return;

  try {
    // Bun + many networks are friendlier to HTTPS/443 than gRPC/8443.
    Laminar.initialize({ projectApiKey, forceHttp: true });
    initialized = true;
  } catch {
    // Observability should never block app startup.
  }
}
