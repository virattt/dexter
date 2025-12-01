#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { config } from 'dotenv';
import { CLI } from './cli.js';

// Load environment variables
config();

// Render the CLI app
render(<CLI />);

