import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { nowISO } from '../lib/dates';

export const db = SQLite.openDatabaseSync('xpvault.db');

export type P = SQLiteBindValue[];
export const all = <T>(sql: string, params: P = []) => db.getAllSync<T>(sql, params);
export const first = <T>(sql: string, params: P = []) => db.getFirstSync<T>(sql, params);
export const run = (sql: string, params: P = []) => db.runSync(sql, params);
export const tx = (fn: () => void) => db.withTransactionSync(fn);

const SCHEMA_VERSION = 2;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  initial_cents INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL,
  budget_cents INTEGER,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  account_id INTEGER,
  start_date TEXT NOT NULL,
  mode TEXT NOT NULL,
  total INTEGER,
  first_number INTEGER NOT NULL DEFAULT 1,
  until_month TEXT,
  end_seq INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  account_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  recurrence_id INTEGER,
  seq INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (recurrence_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_rec ON transactions(recurrence_id);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT NOT NULL,
  current_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  account_id INTEGER,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moves_asset ON asset_moves(asset_id);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  color TEXT NOT NULL,
  asset_id INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS goal_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  xp INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xp_day ON xp_events(day);

CREATE TABLE IF NOT EXISTS achievements (code TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL);
`;

export const TABLES = [
  'meta', 'accounts', 'categories', 'recurrences', 'transactions',
  'assets', 'asset_moves', 'goals', 'goal_moves', 'xp_events', 'achievements',
] as const;

const DEFAULT_CATEGORIES: [string, 'income' | 'expense', string, string][] = [
  ['Moradia', 'expense', 'MOR', '#7AA2FF'],
  ['Mercado', 'expense', 'MER', '#B4F25A'],
  ['Alimentação', 'expense', 'ALI', '#FF9F43'],
  ['Transporte', 'expense', 'TRN', '#45D3FF'],
  ['Contas', 'expense', 'CNT', '#E8E36B'],
  ['Assinaturas', 'expense', 'ASS', '#FF7AD9'],
  ['Saúde', 'expense', 'SAU', '#3DF5B0'],
  ['Lazer', 'expense', 'LAZ', '#B79BFF'],
  ['Educação', 'expense', 'EDU', '#FFC94A'],
  ['Compras', 'expense', 'CMP', '#FF5C7A'],
  ['Outros', 'expense', 'OUT', '#9AA3B8'],
  ['Salário', 'income', 'SAL', '#B4F25A'],
  ['Freela', 'income', 'FRL', '#45D3FF'],
  ['Extra', 'income', 'EXT', '#FFC94A'],
  ['Outros', 'income', 'OUT', '#9AA3B8'],
];

export function initDb() {
  db.execSync('PRAGMA journal_mode = WAL;');
  const row = (() => {
    try {
      return db.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'");
    } catch {
      return null;
    }
  })();
  const current = row ? Number(row.value) : 0;
  if (current < 1) {
    db.execSync(SCHEMA_V1);
    seed();
  }
  if (current < 2) migrateV2();
  // Próximas migrações: if (current < 3) { ... }
  db.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]);
}

function seed() {
  const has = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if (has && has.n > 0) return;
  tx(() => {
    const now = nowISO();
    run('INSERT INTO accounts (name, color, initial_cents, created_at) VALUES (?, ?, 0, ?)', ['Conta principal', '#FFC94A', now]);
    run('INSERT INTO accounts (name, color, initial_cents, created_at) VALUES (?, ?, 0, ?)', ['Carteira', '#B4F25A', now]);
    for (const [name, kind, code, color] of DEFAULT_CATEGORIES) {
      run('INSERT INTO categories (name, kind, code, color) VALUES (?, ?, ?, ?)', [name, kind, code, color]);
    }
  });
}

const hasColumn = (table: string, col: string) =>
  db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).some((c) => c.name === col);

/** v2: contas de benefício (VR/VT/VA), que ficam fora do patrimônio e dos totais. */
function migrateV2() {
  tx(() => {
    if (!hasColumn('accounts', 'kind')) db.execSync("ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'regular'");
    const now = nowISO();
    const nBenefit = first<{ n: number }>("SELECT COUNT(*) AS n FROM accounts WHERE kind = 'benefit'")!.n;
    if (!nBenefit) {
      for (const [name, color] of [['Vale Refeição', '#FF9F43'], ['Vale Transporte', '#7AA2FF'], ['Vale Alimentação', '#3DF5B0']]) {
        run("INSERT INTO accounts (name, color, initial_cents, kind, created_at) VALUES (?, ?, 0, 'benefit', ?)", [name, color, now]);
      }
    }
    const hasBen = first<{ n: number }>("SELECT COUNT(*) AS n FROM categories WHERE kind = 'income' AND code = 'BEN'")!.n;
    if (!hasBen) run("INSERT INTO categories (name, kind, code, color) VALUES ('Benefícios', 'income', 'BEN', '#FF9F43')");
  });
}

export function getMeta(key: string): string | null {
  return first<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null;
}
export function setMeta(key: string, value: string) {
  run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}
