/**
 * Stops the BrowserStack Local tunnel after the run.
 */
import { stopLocal } from './bs-global-setup';

export default async function globalTeardown(): Promise<void> {
  await stopLocal();
}