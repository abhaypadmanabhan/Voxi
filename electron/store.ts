import Database from 'better-sqlite3'
import crypto from 'crypto'
import nodeMachineId from 'node-machine-id'
const { machineIdSync } = nodeMachineId
import { homedir } from 'os'
import { mkdirSync } from 'fs'
import { join } from 'path'

const DB_DIR = join(homedir(), '.flow')
const DB_PATH = join(DB_DIR, 'user.db')

function openDb(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_vocab (
      word       TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)
  return db
}

const db = openDb()

// ── Encryption helpers ──────────────────────────────────────────────────────

function encryptionKey(): Buffer {
  const id = machineIdSync()
  return crypto.createHash('sha256').update(id).digest() // 32 bytes
}

export function encrypt(plaintext: string): string {
  const key = encryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + enc.toString('hex')
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':')
  const key = encryptionKey()
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.from(ivHex, 'hex'),
  )
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

// ── User vocabulary (explicit bias for Whisper initial_prompt) ──────────────

export function addVocabEntry(word: string): void {
  const trimmed = word.trim()
  if (!trimmed) return
  db.prepare(
    `INSERT INTO user_vocab (word) VALUES (?)
     ON CONFLICT(word) DO NOTHING`,
  ).run(trimmed)
}

export function removeVocabEntry(word: string): void {
  db.prepare('DELETE FROM user_vocab WHERE word = ?').run(word.trim())
}

export function getVocabulary(): string[] {
  const rows = db
    .prepare('SELECT word FROM user_vocab ORDER BY created_at DESC')
    .all() as Array<{ word: string }>
  return rows.map((r) => r.word)
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}

/** Encrypt and store an API key. */
export function setApiKey(name: string, value: string): void {
  setSetting(`api_key_${name}`, encrypt(value))
}

/** Retrieve and decrypt an API key. Returns null if not stored. */
export function getApiKey(name: string): string | null {
  const raw = getSetting(`api_key_${name}`)
  if (!raw) return null
  try {
    return decrypt(raw)
  } catch {
    return null
  }
}
