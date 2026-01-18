#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

// Load environment variables
config({ quiet: true });

// Debug: Log terminal and stdin information
console.log('\n=== DEBUG INFO ===');
console.log('Platform:', process.platform);
console.log('Node version:', process.version);
console.log('stdin isTTY:', process.stdin.isTTY);
console.log('stdout isTTY:', process.stdout.isTTY);
console.log('stdin readable:', process.stdin.readable);
console.log('stdin readableHighWaterMark:', process.stdin.readableHighWaterMark);
console.log('Terminal:', process.env.TERM || 'not set');
console.log('CI environment:', process.env.CI || 'not set');
console.log('==================\n');

// Render the CLI app
const { clear, unmount, waitUntilExit } = render(<CLI />);

// Handle stdin errors
process.stdin.on('error', (err) => {
  console.error('stdin error:', err);
});

// Log when app starts
console.log('\n[DEBUG] App rendered, waiting for input...\n');
