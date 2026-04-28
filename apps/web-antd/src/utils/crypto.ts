import { SM4 } from 'gm-crypto';

const ITERATIONS = 100000;
const KEY_LENGTH = 128; // bits for SM4

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive SM4 key from master password using PBKDF2
 */
async function deriveKey(
  masterPassword: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(masterPassword);
  const saltBuffer = hexStringToBuffer(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  );

  return bufferToHexString(new Uint8Array(derivedBits));
}

/**
 * Encrypt text using SM4
 */
export async function encryptText(
  plaintext: string,
  masterPassword: string,
  salt: string
): Promise<string> {
  const key = await deriveKey(masterPassword, salt);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = SM4.encrypt(
    bufferToHexString(data),
    key,
    { mode: 'GCM', iv: hexStringToBuffer(salt.slice(0, 16)) }
  );

  return encrypted;
}

/**
 * Decrypt text using SM4
 */
export async function decryptText(
  ciphertext: string,
  masterPassword: string,
  salt: string
): Promise<string> {
  const key = await deriveKey(masterPassword, salt);

  const decrypted = SM4.decrypt(
    ciphertext,
    key,
    { mode: 'GCM', iv: hexStringToBuffer(salt.slice(0, 16)) }
  );

  const decoder = new TextDecoder();
  return decoder.decode(hexStringToBuffer(decrypted));
}

/**
 * Convert hex string to ArrayBuffer
 */
function hexStringToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHexString(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random password
 */
export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*';
const AMBIGUOUS = '0O1lI';

export function generatePassword(options: PasswordGeneratorOptions): string {
  let chars = '';
  let required = [];

  if (options.uppercase) {
    chars += options.excludeAmbiguous
      ? UPPERCASE.split('').filter((c) => !AMBIGUOUS.includes(c)).join('')
      : UPPERCASE;
    required.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  if (options.lowercase) {
    chars += options.excludeAmbiguous
      ? LOWERCASE.split('').filter((c) => !AMBIGUOUS.includes(c)).join('')
      : LOWERCASE;
    required.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  if (options.numbers) {
    chars += options.excludeAmbiguous
      ? NUMBERS.split('').filter((c) => !AMBIGUOUS.includes(c)).join('')
      : NUMBERS;
    required.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  if (options.symbols) {
    chars += SYMBOLS;
    required.push(chars[Math.floor(Math.random() * chars.length)]);
  }

  if (chars.length === 0) {
    chars = LOWERCASE + NUMBERS;
  }

  let password = '';
  const requiredCount = required.length;
  const remainingLength = options.length - requiredCount;

  for (let i = 0; i < remainingLength; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Mix required characters into the password
  const allChars = password.split('');
  for (let i = 0; i < requiredCount; i++) {
    const pos = Math.floor(Math.random() * (allChars.length + 1));
    allChars.splice(pos, 0, required[i]);
  }

  return allChars.join('').slice(0, options.length);
}