// Simple test to check if stdin works
const readline = require('readline');

console.log('=== STDIN TEST ===');
console.log('Platform:', process.platform);
console.log('stdin isTTY:', process.stdin.isTTY);
console.log('stdout isTTY:', process.stdout.isTTY);
console.log('==================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Type something and press Enter: ', (answer) => {
  console.log('\nYou typed:', answer);
  rl.close();
  process.exit(0);
});
