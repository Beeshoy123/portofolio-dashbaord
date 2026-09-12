import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

const attempts = [
  ['npx', '--yes', 'graphify', '.', '--output', 'graphify-out'],
  ['npx', '--yes', 'graphify', '--output', 'graphify-out', '.'],
  ['graphify', '.', '--output', 'graphify-out'],
  ['graphify', '--output', 'graphify-out', '.'],
];

let lastError = null;

for (const command of attempts) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    lastError = result.error;
    continue;
  }

  if (result.status === 0) {
    console.log(`Graphify refresh succeeded via: ${command.join(' ')}`);
    process.exit(0);
  }

  lastError = new Error(`Command failed with exit code ${result.status}: ${command.join(' ')}`);
}

console.error('Graphify CLI was not available in the current environment.');
if (lastError) {
  console.error(lastError.message);
}
console.error('Install the Graphify VS Code extension and/or run from a machine with the Graphify CLI available.');
process.exit(1);
