#!/bin/bash

# Script to install dependencies and modify Ink's parse-keypress.js to separate backspace and delete keys

set -e

bun install

echo "Modifying Ink's parse-keypress.js to separate backspace and delete keys..."

INK_PARSE_KEYPRESS="node_modules/ink/build/parse-keypress.js"

if [ ! -f "$INK_PARSE_KEYPRESS" ]; then
    echo "Error: $INK_PARSE_KEYPRESS not found. Make sure dependencies are installed."
    exit 1
fi

# Create a backup
cp "$INK_PARSE_KEYPRESS" "$INK_PARSE_KEYPRESS.bak"

# Use Node.js to modify the file (more reliable than sed for complex replacements)
node << 'EOF'
const fs = require('fs');

const filePath = 'node_modules/ink/build/parse-keypress.js';
let content = fs.readFileSync(filePath, 'utf8');

// The issue: Most terminals send \x7f (DEL) for Backspace key, not \b
// The actual Delete key sends [3~ sequence, which is already mapped to 'delete' in keyName (line 50)
// So we need to keep \x7f as 'backspace' (what terminals send for Backspace)
// and let [3~ remain as 'delete' (what terminals send for Delete key)

// Check if file was already incorrectly modified (has \x7f mapped to delete)
const incorrectlyModified = /else if \(s === '\\x7f' \|\| s === '\\x1b\\x7f'\) \{[\s\S]*?key\.name = 'delete'/.test(content);

if (incorrectlyModified) {
    // File was incorrectly modified, fix it
    console.log('Fixing incorrect modification...');
    
    // Match both the \b block and the \x7f block if they're separate
    const separatePattern = /else if \(s === '\\b' \|\| s === '\\x1b\\b'\) \{[\s\S]*?\}[\s\S]*?else if \(s === '\\x7f' \|\| s === '\\x1b\\x7f'\) \{[\s\S]*?key\.name = 'delete';[\s\S]*?\}/;
    
    if (separatePattern.test(content)) {
        // Replace the separate blocks with a single correct block
        const newCode = `else if (s === '\\b' || s === '\\x1b\\b' || s === '\\x7f' || s === '\\x1b\\x7f') {
        // backspace - delete character before cursor
        // Most terminals send \\x7f (DEL) for backspace key, not \\b
        // We keep both as backspace since that's what users expect
        key.name = 'backspace';
        key.meta = s.charAt(0) === '\\x1b';
    }`;
        content = content.replace(separatePattern, newCode);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully fixed parse-keypress.js');
    } else {
        console.error('Error: Could not find the expected pattern to fix');
        process.exit(1);
    }
} else {
    // Check if it's the original unmodified file
    const originalPattern = /else if \(s === '\\b' \|\| s === '\\x1b\\b' \|\| s === '\\x7f' \|\| s === '\\x1b\\x7f'\) \{[\s\S]*?key\.name = 'backspace';[\s\S]*?\}/;
    
    if (originalPattern.test(content)) {
        // Original file is already correct (treats both as backspace)
        // No modification needed, but we'll keep it as is
        console.log('File already correctly configured (both \\b and \\x7f map to backspace)');
        console.log('Note: Delete key sends [3~ sequence, which is already mapped to delete');
    } else {
        console.error('Error: Could not identify file pattern');
        console.error('The file may have been modified in an unexpected way');
        process.exit(1);
    }
}

// Verify that [3~ is still mapped to 'delete' (this is what Delete key sends)
if (!content.includes("'[3~': 'delete'")) {
    console.warn('Warning: [3~ mapping to delete not found. Delete key may not work correctly.');
} else {
    console.log('Verified: [3~ sequence correctly mapped to delete (Delete key)');
}
EOF
echo "Backup saved as $INK_PARSE_KEYPRESS.bak"
echo ""
echo "Setup complete! You can now use:"
echo "  - Backspace key: deletes character before cursor"
echo "  - Delete key: deletes character after cursor"

