/**
 * Mockable filesystem wrapper.
 *
 * Exposes a thin wrapper around Node.js `fs` sync operations so that
 * tests can replace individual methods without relying on `jest.mock()`.
 */

import fs from "node:fs";

/**
 * Object holding filesystem operations.
 *
 * The production implementation delegates directly to `node:fs`.
 * Tests can replace individual properties (e.g. `fsWrapper.existsSync`)
 * to control behaviour without monkey-patching the built-in module.
 */
export const fsWrapper = {
  existsSync: (path: string): boolean => fs.existsSync(path),

  statSync: (path: string): fs.Stats => fs.statSync(path),

  accessSync: (path: string, mode?: number): void =>
    fs.accessSync(path, mode),
};
