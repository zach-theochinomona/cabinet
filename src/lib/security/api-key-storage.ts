/**
 * Secure API Key Storage
 * 
 * Stores API keys encrypted on disk. Uses AES-256-GCM encryption
 * with a key derived from a machine-specific secret.
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";

const KEYS_DIR = path.join(os.homedir(), ".cabinet", "keys");
const KEY_FILE = path.join(KEYS_DIR, "api-keys.enc");
const SALT_FILE = path.join(KEYS_DIR, "salt");
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface ApiKey {
  provider: string;
  key: string;
  name?: string;
  createdAt: string;
  lastUsed?: string;
}

export interface EncryptedKey {
  provider: string;
  encrypted: string;
  iv: string;
  tag: string;
  name?: string;
  createdAt: string;
  lastUsed?: string;
}

/**
 * Get or create encryption key
 */
async function getEncryptionKey(): Promise<Buffer> {
  await fs.mkdir(KEYS_DIR, { recursive: true });
  
  let salt: Buffer;
  try {
    salt = await fs.readFile(SALT_FILE);
  } catch {
    salt = crypto.randomBytes(32);
    await fs.writeFile(SALT_FILE, salt);
  }
  
  // Use machine-specific info + salt to derive key
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.pbkdf2Sync(machineId, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Encrypt a string
 */
function encrypt(text: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypt a string
 */
function decrypt(encrypted: string, iv: string, tag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Load all encrypted keys
 */
async function loadEncryptedKeys(): Promise<EncryptedKey[]> {
  try {
    const data = await fs.readFile(KEY_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save encrypted keys
 */
async function saveEncryptedKeys(keys: EncryptedKey[]): Promise<void> {
  await fs.mkdir(KEYS_DIR, { recursive: true });
  await fs.writeFile(KEY_FILE, JSON.stringify(keys, null, 2));
}

/**
 * Store an API key securely
 */
export async function storeApiKey(provider: string, key: string, name?: string): Promise<void> {
  const encryptionKey = await getEncryptionKey();
  const encrypted = encrypt(key, encryptionKey);
  
  const keys = await loadEncryptedKeys();
  const existingIndex = keys.findIndex(k => k.provider === provider);
  
  const encryptedKey: EncryptedKey = {
    provider,
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    tag: encrypted.tag,
    name: name || provider,
    createdAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    keys[existingIndex] = encryptedKey;
  } else {
    keys.push(encryptedKey);
  }
  
  await saveEncryptedKeys(keys);
}

/**
 * Retrieve an API key
 */
export async function getApiKey(provider: string): Promise<string | null> {
  const keys = await loadEncryptedKeys();
  const key = keys.find(k => k.provider === provider);
  
  if (!key) return null;
  
  try {
    const encryptionKey = await getEncryptionKey();
    return decrypt(key.encrypted, key.iv, key.tag, encryptionKey);
  } catch (error) {
    console.error(`Failed to decrypt key for ${provider}:`, error);
    return null;
  }
}

/**
 * List all stored providers
 */
export async function listApiKeys(): Promise<Array<{ provider: string; name?: string; createdAt: string }>> {
  const keys = await loadEncryptedKeys();
  return keys.map(k => ({
    provider: k.provider,
    name: k.name,
    createdAt: k.createdAt,
  }));
}

/**
 * Remove an API key
 */
export async function removeApiKey(provider: string): Promise<void> {
  const keys = await loadEncryptedKeys();
  const filtered = keys.filter(k => k.provider !== provider);
  await saveEncryptedKeys(filtered);
}

/**
 * Check if a key exists
 */
export async function hasApiKey(provider: string): Promise<boolean> {
  const keys = await loadEncryptedKeys();
  return keys.some(k => k.provider === provider);
}

/**
 * Get available providers with keys
 */
export async function getAvailableProviders(): Promise<string[]> {
  const keys = await loadEncryptedKeys();
  return keys.map(k => k.provider);
}

/**
 * Test an API key (basic validation)
 */
export async function testApiKey(provider: string, key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case "openrouter":
        // Test OpenRouter API
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
        });
        return { valid: response.ok };
      
      case "gemini":
        // Test Gemini API
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        return { valid: geminiResponse.ok };
      
      case "openai":
        // Test OpenAI API
        const openaiResponse = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
        });
        return { valid: openaiResponse.ok };
      
      default:
        return { valid: true }; // Can't test unknown providers
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
