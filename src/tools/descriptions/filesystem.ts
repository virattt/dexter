export const READ_FILE_DESCRIPTION = `Read the contents of a file from the local filesystem.

## When to Use

- Reading configuration files (package.json, tsconfig.json, .env files)
- Analyzing code files or scripts
- Accessing data files (CSV, JSON, XML, etc.)
- Reading documentation or text files
- Inspecting log files

## When NOT to Use

- For directories - this tool ONLY reads individual files, not directories
- If you need to see what files are in a directory, you must first list the directory contents
- For binary files (images, videos, executables) - this tool is for text files only
- For files that don't exist yet (will return an error)

## Important Notes

- **Directories are not supported**: If you try to read a directory, you'll get an error
- **One file at a time**: This tool reads a single file per call
- **Relative paths**: Paths are resolved relative to the current working directory

## Permission System

This tool requires user permission before accessing files:
- First access to a file will prompt the user for permission
- Permission is saved and reused for subsequent accesses
- Certain system paths are blocked for security

## Output Format

Returns a JSON object with:
- path: Absolute path to the file
- content: Full text content of the file
- size: File size in KB
- lines: Number of lines in the file

## Examples

Read a configuration file:
\`\`\`
{
  "path": "package.json"
}
\`\`\`

Read a specific file with absolute path:
\`\`\`
{
  "path": "/home/user/documents/report.txt"
}
\`\`\`

Read a source file:
\`\`\`
{
  "path": "src/index.ts"
}
\`\`\``;
