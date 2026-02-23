import { Schema } from 'effect';

/**
 * Generate a random base32 string using Crockford's alphabet.
 * Uses Web Crypto API for cross-platform compatibility.
 */
const generateRandomBase32 = (length: number = 16): string => {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  const bytes = new Uint8Array(Math.ceil((length * 5) / 8));
  globalThis.crypto.getRandomValues(bytes);
  let result = '';
  let buffer = 0;
  let bitsLeft = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      result += alphabet[(buffer >> bitsLeft) & 0x1f];
    }
  }

  return result.slice(0, length);
};

export const JobIdSchema = Schema.String.pipe(
  Schema.pattern(/^job_[0-9a-hjkmnp-tv-z]{16}$/, {
    message: () => 'Invalid job ID format',
  }),
  Schema.brand('JobId'),
);

export type JobId = typeof JobIdSchema.Type;

export const generateJobId = (): JobId =>
  `job_${generateRandomBase32()}` as JobId;

export const UserIdSchema = Schema.String.pipe(Schema.brand('UserId'));

export type UserId = typeof UserIdSchema.Type;
