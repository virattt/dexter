export const READ_FILE_DESCRIPTION = `
Read file contents from the local workspace.

## When to Use

- Reading local project files before making edits
- Inspecting config/code/data files in the workspace
- Paginating large files with \`offset\` and \`limit\`

## When NOT to Use

- Fetching web URLs (use \`web_fetch\`)
- Looking up financial APIs (use \`financial_search\` / \`financial_metrics\`)
- Writing or changing files (use \`write_file\` / \`edit_file\`)

## Usage Notes

- Accepts \`path\` (absolute or relative to current workspace)
- Optional \`offset\` is 1-indexed line number
- Optional \`limit\` caps returned lines
- Large output is truncated with continuation hints
`.trim();
