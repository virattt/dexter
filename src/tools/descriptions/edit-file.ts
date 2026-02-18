export const EDIT_FILE_DESCRIPTION = `
Perform precise in-place text edits in a local workspace file.

## When to Use

- Replacing a specific block/string in an existing file
- Making surgical code/config edits without rewriting full file

## When NOT to Use

- Creating or overwriting entire files (use \`write_file\`)
- Reading file contents (use \`read_file\`)

## Usage Notes

- The system will prompt the user for confirmation automatically; just call the tool directly
- Accepts \`path\`, \`old_text\`, and \`new_text\`
- \`old_text\` must be unique in the file; ambiguous matches are rejected
- Preserves BOM and line ending style where possible
- Returns a unified diff summary of the change
`.trim();
