#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { initializeLaminar } from './observability/laminar.js';

// Load environment variables
config({ quiet: true });

// If Laminar tracing is enabled, disable LangSmith tracing to avoid double-instrumentation.
const lmnrKey = process.env.LMNR_PROJECT_API_KEY?.trim();
if (lmnrKey && !lmnrKey.startsWith('your-')) {
  process.env.LANGSMITH_TRACING = 'false';
  process.env.LANGCHAIN_TRACING_V2 = 'false';
  process.env.LANGCHAIN_TRACING = 'false';
}

// Initialize Laminar (must happen before importing any LangChain code)
initializeLaminar();

// Import after observability is initialized
const { CLI } = await import('./cli.js');

// Render the CLI app
render(<CLI />);
