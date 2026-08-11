/**
 * Load repo-root `.env` into process.env before Prisma (or other clients) read it.
 * Side-effect import this module first: `import './load-env';`
 *
 * Uses Node's built-in process.loadEnvFile when available (Node 20.12+ / 22+).
 * Does not override variables already set in the shell.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    // Minimal fallback for older Node: KEY=VALUE lines, ignore comments/blanks.
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
