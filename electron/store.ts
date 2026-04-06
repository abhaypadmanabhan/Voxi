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
    CREATE TABLE IF NOT EXISTS corrections (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      raw       TEXT NOT NULL,
      corrected TEXT NOT NULL,
      app       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vocabulary (
      word       TEXT PRIMARY KEY,
      correction TEXT NOT NULL,
      count      INTEGER DEFAULT 1
    );
  `)
  // Migrate: add confidence column if missing
  const cols = db.prepare('PRAGMA table_info(corrections)').all() as Array<{ name: string }>
  if (!cols.some(c => c.name === 'confidence')) {
    db.exec('ALTER TABLE corrections ADD COLUMN confidence REAL DEFAULT 1.0')
  }
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

// ── Corrections ─────────────────────────────────────────────────────────────

export function addCorrection(raw: string, corrected: string, app: string, confidence = 1.0): void {
  db.prepare(
    'INSERT INTO corrections (raw, corrected, app, confidence) VALUES (?, ?, ?, ?)',
  ).run(raw, corrected, app, confidence)
}

export function getRecentCorrections(limit = 10): Array<{ raw: string; corrected: string }> {
  return db
    .prepare('SELECT raw, corrected FROM corrections ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{ raw: string; corrected: string }>
}

/** Returns the most recent correction for an exact raw string, or null. */
export function findCorrection(raw: string): string | null {
  const row = db
    .prepare(
      `SELECT corrected FROM corrections
       WHERE raw = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(raw) as { corrected: string } | undefined
  return row?.corrected ?? null
}

export function clearCorrections(): void {
  db.prepare('DELETE FROM corrections').run()
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
