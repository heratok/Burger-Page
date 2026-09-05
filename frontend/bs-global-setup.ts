/**
 * BrowserStack Local tunnel for the classic connectOptions integration.
 * Starts the tunnel against localhost so cloud browsers can reach the app.
 */
import { Local } from 'browserstack-local';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let local: Local | null = null;

export default async function globalSetup(): Promise<void> {
  const key = process.env.BROWSERSTACK_ACCESS_KEY;
  if (!key) throw new Error('BROWSERSTACK_ACCESS_KEY is required');

  local = new Local();
  await new Promise<void>((resolve, reject) => {
    local!.start(
      {
        key,
        forceLocal: true,
        onlyAutomate: true,
        logFile: path.join(__dirname, 'bs-local.log'),
      },
      (err?: Error) => (err ? reject(err) : resolve())
    );
  });
  console.log(`BrowserStack Local running: ${local.isRunning()}`);
}

export function stopLocal(): Promise<void> {
  return new Promise((resolve) => {
    if (!local) return resolve();
    local.stop(() => resolve());
  });
}