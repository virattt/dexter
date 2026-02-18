export const WRITE_FILE_DESCRIPTION = `
Create or overwrite files in the local workspace.

## When to Use

- Creating a new file with full contents
- Replacing an existing file entirely
- Writing generated output to disk

## When NOT to Use

- Small surgical updates in an existing file (use \`edit_file\`)
- Reading file contents (use \`read_file\`)

## Usage Notes

- The system will prompt the user for confirmation automatically; just call the tool directly
- Accepts \`path\` and full \`content\`
- Creates parent directories when they do not exist
- Overwrites existing file content completely
`.trim();
