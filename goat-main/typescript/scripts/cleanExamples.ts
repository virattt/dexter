#!/usr/bin/env node

/**
 * Changesets adds a changelog file to the example directories when running `pnpm change:version`.
 * This script removes the changelog file and resets the package.json version to 0.0.0.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exampleDirs = ["examples/by-framework", "examples/by-use-case", "examples/by-wallet"];

// Get all example directories
function getExampleDirs(baseDir: string): string[] {
    const dirs: string[] = [];

    for (const exampleDir of exampleDirs) {
        const fullPath = path.join(baseDir, exampleDir);
        if (!fs.existsSync(fullPath)) continue;

        const contents = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const content of contents) {
            if (content.isDirectory()) {
                dirs.push(path.join(fullPath, content.name));
            }
        }
    }

    return dirs;
}

// Clean an individual example directory
function cleanExampleDir(dir: string) {
    // Delete CHANGELOG.md if it exists
    const changelogPath = path.join(dir, "CHANGELOG.md");
    if (fs.existsSync(changelogPath)) {
        fs.unlinkSync(changelogPath);
        console.log(`Deleted ${changelogPath}`);
    }

    // Reset package.json version
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        packageJson.version = "0.0.0";
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
        console.log(`Reset version in ${packageJsonPath}`);
    }
}

// Get root directory (2 levels up from script location)
const rootDir = path.resolve(__dirname, "..");

// Process all example directories
const dirs = getExampleDirs(rootDir);
for (const dir of dirs) {
    cleanExampleDir(dir);
}

console.log("Finished cleaning example directories");
