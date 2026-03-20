# Code Quality Tools

This project uses ESLint and Prettier to maintain code quality and consistency.

## Setup

The code quality tools are automatically installed via `bun install`. To set up the git hooks:

```bash
bun run prepare
```

## Available Scripts

- `bun run lint` - Run ESLint to check code quality
- `bun run lint:fix` - Automatically fix ESLint issues
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check if code is formatted
- `bun run check` - Run all checks (typecheck, lint, format check)

## Pre-commit Hooks

Husky is configured to run lint-staged before each commit. This means:

- ESLint will auto-fix issues in staged files
- Prettier will format staged files
- If there are remaining issues, the commit will be blocked

## Configuration Files

- `eslint.config.mjs` - ESLint configuration with TypeScript support
- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files/directories to ignore

## VS Code Integration

For the best experience, install these VS Code extensions:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

Then add these settings to your `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["javascript", "typescript", "typescriptreact", "javascriptreact"]
}
```

## CI/CD Integration

The CI pipeline runs:

- `bun run typecheck` - TypeScript type checking
- `bun run lint` - ESLint code quality checks
- `bun run format:check` - Prettier formatting validation

All checks must pass before a PR can be merged.
