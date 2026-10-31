// Lints only the .js/.jsx/.mjs files that differ from origin/beta:
// committed changes, staged/unstaged changes and new untracked files.
// Run `npm run lint` for the full-repo lint.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE_REF = 'origin/beta';
const LINTABLE = /\.(?:js|jsx|mjs)$/;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// -z gives NUL-separated, unquoted paths, so spaces and accents are safe.
function gitList(args, cwd) {
  return git(args, cwd).split('\0').filter(Boolean);
}

function refExists(ref, cwd) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

const root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
const candidates = new Set();

if (refExists(BASE_REF, root)) {
  gitList(['diff', '--name-only', '-z', '--diff-filter=ACMR', `${BASE_REF}...HEAD`], root)
    .forEach((file) => candidates.add(file));
} else {
  console.warn(
    `lint-changed: ${BASE_REF} is not available here (shallow or single-branch clone?). ` +
    'Only uncommitted files are checked; committed changes are NOT covered.'
  );
}

gitList(['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'], root)
  .forEach((file) => candidates.add(file));
gitList(['ls-files', '-z', '--others', '--exclude-standard'], root)
  .forEach((file) => candidates.add(file));

const files = [...candidates]
  .filter((file) => LINTABLE.test(file) && existsSync(path.join(root, file)))
  .sort();

if (files.length === 0) {
  console.log(`lint-changed: no changed .js/.jsx/.mjs files vs ${BASE_REF}; nothing to lint.`);
  process.exit(0);
}

console.log(`lint-changed: linting ${files.length} file(s) changed vs ${BASE_REF}:`);
files.forEach((file) => console.log(`  ${file}`));

// Run ESLint through node itself: no .cmd shim, no shell, same on Windows and Linux.
const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!existsSync(eslintBin)) {
  console.error('lint-changed: ESLint is not installed (run npm ci first).');
  process.exit(1);
}

const result = spawnSync(process.execPath, [eslintBin, ...files], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
