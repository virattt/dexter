#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

// Load environment variables
config({ quiet: true });

// Render the CLI app and wait for it to exit
// This keeps the process alive until the user exits
const { waitUntilExit } = render(<CLI />);
await waitUntilExit();
