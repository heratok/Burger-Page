import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const scripts = (
  JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

describe('package.json migration scripts (node-pg-migrate 9 wiring)', () => {
  it('db:baseline uses `up --fake` (the CLI has no baseline action)', () => {
    expect(scripts['db:baseline']).toMatch(/\bup --fake$/);
    expect(scripts['db:baseline']).not.toMatch(/\bbaseline$/);
    expect(scripts['db:baseline']).toContain('doppler run --');
  });

  it('db:migrate:down uses the psql-based script, not the native down action', () => {
    expect(scripts['db:migrate:down']).toBe('doppler run -- bash database/scripts/migrate-down.sh');
    expect(existsSync(resolve(root, 'database/scripts/migrate-down.sh'))).toBe(true);
  });

  it('db:migrate keeps ignoring only down files and docs', () => {
    expect(scripts['db:migrate']).toContain('--ignore-pattern ".*\\.down\\.sql|.*\\.md" up');
  });
});
