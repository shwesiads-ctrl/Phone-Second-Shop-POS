import { scrypt } from "@noble/hashes/scrypt.js";
import { Buffer } from "buffer";
export { Buffer };
export function randomBytes(length: number) {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(length)));
}
export function randomUUID() {
  return globalThis.crypto.randomUUID();
}
export function scryptSync(password: string, salt: string, length: number) {
  return Buffer.from(
    scrypt(password, salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: length,
      maxmem: 32 * 1024 * 1024,
    }),
  );
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
