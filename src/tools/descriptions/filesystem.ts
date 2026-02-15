/**
 * Rich descriptions for the file system tools (read_file, write_file, edit_file).
 * Used in the system prompt to guide the LLM on when and how to use these tools.
 */

export const READ_FILE_DESCRIPTION = `
Read a file from the local file system. Returns content with line numbers.

## When to Use

- Reading source code, configuration files, or data files
- Inspecting file contents before making edits
- Reviewing project structure and code organization

## When NOT to Use

- Reading web pages or remote URLs (use web_fetch instead)
- Reading SEC filings (use read_filings instead)
- Listing directory contents (use a shell command instead)

## Schema

- **file_path** (required): Absolute or relative path to the file
- **offset** (optional): Line number to start reading from (0-based, default 0)
- **limit** (optional): Maximum number of lines to read (default 2000)

## Returns

File content with line numbers (cat -n style). Includes metadata about total lines and truncation.

## Usage Notes

- Always read a file before editing it to understand its current content
- Use offset and limit for large files to avoid overwhelming the context
- Lines longer than 2000 characters are truncated
- Requires file system permissions — see .dexter/permissions.json
`.trim();

export const WRITE_FILE_DESCRIPTION = `
Write content to a file on the local file system. Creates the file or overwrites it.

## When to Use

- Creating new files (scripts, configurations, data files)
- Overwriting a file with entirely new content
- Saving generated output to disk

## When NOT to Use

- Making small edits to an existing file (use edit_file instead — it's safer)
- Appending to a file (read first, then write the combined content)

## Schema

- **file_path** (required): Absolute or relative path to the file
- **content** (required): The content to write to the file

## Returns

Confirmation with file path and bytes written.

## Usage Notes

- Creates parent directories automatically if they don't exist
- Overwrites the file if it already exists — be careful with existing files
- Prefer edit_file for targeted changes to avoid accidentally losing content
- Requires file system permissions — see .dexter/permissions.json
`.trim();

export const EDIT_FILE_DESCRIPTION = `
Perform exact string replacement in a file. Finds old_string and replaces it with new_string.

## When to Use

- Making targeted edits to existing files
- Fixing bugs, updating values, or refactoring code
- Renaming variables or strings across a file (with replace_all)

## When NOT to Use

- Creating a new file from scratch (use write_file instead)
- Rewriting most of a file's content (use write_file instead)

## Schema

- **file_path** (required): Absolute or relative path to the file
- **old_string** (required): The exact text to find and replace
- **new_string** (required): The replacement text
- **replace_all** (optional): If true, replace all occurrences (default false)

## Returns

Confirmation with the number of replacements made.

## Usage Notes

- Always read the file first so you know the exact content to match
- old_string must match exactly, including whitespace and indentation
- By default, old_string must appear exactly once (prevents accidental mass edits)
- Use replace_all: true to replace all occurrences (e.g., renaming a variable)
- Requires file system permissions — see .dexter/permissions.json
`.trim();
