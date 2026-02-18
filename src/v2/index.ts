#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';

config({ quiet: true });
await runCli();
