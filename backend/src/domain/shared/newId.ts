/**
 * The single id generator of the backend: every new entity id is
 * `<prefix>_<uuidv7>`.
 *
 * - Time-ordered (UUIDv7, RFC 9562): new rows append to the right edge of the
 *   primary-key index instead of scattering across it, and ids sort by
 *   creation time.
 * - Matches the database CHECK on every primary key (`ID_PATTERN`): only
 *   letters, digits, `_` and `-`, at most 64 characters.
 * - No dependency: implemented on the Web Crypto API that Node 22 exposes as
 *   `globalThis.crypto`, so it also stays free of Node imports in the domain.
 *
 * Ids already persisted keep their old shape (`ord_<uuidv4>`, `rest-...`);
 * only newly created entities use this generator.
 */

/** Same pattern as the `chk_<table>_id_format` CHECK constraints. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Established id prefixes per entity. */
export const ID_PREFIX = {
  restaurant: 'rest',
  user: 'usr',
  category: 'cat',
  product: 'prod',
  addition: 'add',
  customer: 'cust',
  order: 'ord',
  orderItem: 'ord_item',
  orderAddition: 'ord_add',
  supplier: 'sup',
  inventory: 'inv',
  openingHours: 'oh',
  table: 'tbl',
} as const;

const PREFIX_PATTERN = /^[a-z][a-z0-9_]*$/;
// 64 (column limit) - 36 (uuid) - 1 (separator)
const MAX_PREFIX_LENGTH = 27;

// The 12-bit rand_a field doubles as a per-millisecond counter (RFC 9562
// method 1). It is seeded below 2^11 so a burst has at least 2048 increments
// before the millisecond has to be borrowed from the next one.
const COUNTER_SEED_LIMIT = 0x800;
const COUNTER_MAX = 0xfff;

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function randomCounterSeed(): number {
  const [value] = new Uint16Array(randomBytes(2).buffer);
  return value % COUNTER_SEED_LIMIT;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function format(bytes: Uint8Array): string {
  const h = Array.from(bytes, (b) => HEX[b]);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h
    .slice(8, 10)
    .join('')}-${h.slice(10, 16).join('')}`;
}

/**
 * Creates a UUIDv7 generator with its own monotonic state. Ids from one
 * generator are strictly increasing: within a millisecond a counter breaks the
 * tie, and a clock that goes backwards keeps using the last timestamp.
 */
export function createUuidV7Generator(clock: () => number = Date.now): () => string {
  let lastMs = 0;
  let counter = 0;

  return () => {
    let ms = Math.max(Math.floor(clock()), lastMs);
    if (ms === lastMs) {
      counter += 1;
      if (counter > COUNTER_MAX) {
        ms += 1;
        counter = randomCounterSeed();
      }
    } else {
      counter = randomCounterSeed();
    }
    lastMs = ms;

    const bytes = randomBytes(16);
    // 48-bit big-endian unix timestamp in milliseconds.
    const high = Math.floor(ms / 0x10000);
    bytes[0] = (high >>> 24) & 0xff;
    bytes[1] = (high >>> 16) & 0xff;
    bytes[2] = (high >>> 8) & 0xff;
    bytes[3] = high & 0xff;
    bytes[4] = (ms >>> 8) & 0xff;
    bytes[5] = ms & 0xff;
    // Version 7 + the 12-bit counter.
    bytes[6] = 0x70 | (counter >>> 8);
    bytes[7] = counter & 0xff;
    // Variant 10xx + 62 random bits.
    bytes[8] = 0x80 | (bytes[8] & 0x3f);
    return format(bytes);
  };
}

/** Process-wide UUIDv7 generator. */
export const uuidv7: () => string = createUuidV7Generator();

/** Returns `<prefix>_<uuidv7>`; throws when the prefix cannot yield a valid id. */
export function newId(prefix: string): string {
  if (!PREFIX_PATTERN.test(prefix) || prefix.length > MAX_PREFIX_LENGTH) {
    throw new Error(`Invalid id prefix: ${JSON.stringify(prefix)}`);
  }
  return `${prefix}_${uuidv7()}`;
}

/** True when the value is a string the database accepts as a primary key. */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}
