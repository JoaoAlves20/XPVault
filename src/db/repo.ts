import { all, first, run, tx, TABLES, db } from './db';
import { addMonths, dateInMonth, monthDiff, monthOf, nowISO, thisMonth, todayISO, addDays } from '../lib/dates';

// ───────────────────────── Tipos ─────────────────────────
export type Kind = 'income' | 'expense';
export type Status = 'planned' | 'done' | 'skipped';
export type RepeatMode = 'forever' | 'count' | 'until';
export type Scope = 'one' | 'future' | 'all';

export interface Account { id: number; name: string; color: string; initial_cents: number; archived: number; balance: number }
export interface Category { id: number; name: string; kind: Kind; code: string; color: string; budget_cents: number | null; archived: number }
export interface Recurrence {
  id: number; kind: Kind; amount_cents: number; description: string; category_id: number | null; account_id: number | null;
  start_date: string; mode: RepeatMode; total: number | null; first_number: number; until_month: string | null; end_seq: number | null; created_at: string;
}
export interface Tx {
  id: number; kind: Kind; amount_cents: number; description: string; category_id: number | null; account_id: number | null;
  date: string; status: Status; recurrence_id: number | null; seq: number | null; created_at: string;
  cat_name: string | null; cat_code: string | null; cat_color: string | null; acc_name: string | null;
  rec_mode: RepeatMode | null; rec_total: number | null; rec_first: number | null; rec_until: string | null;
}
export type AssetType = 'rf' | 'tesouro' | 'acoes' | 'fii' | 'cripto' | 'prev' | 'outro';
export interface Asset { id: number; name: string; type: AssetType; color: string; current_cents: number; updated_at: string; archived: number; invested: number }
export interface AssetMove { id: number; asset_id: number; kind: 'aporte' | 'resgate'; amount_cents: number; account_id: number | null; date: string; note: string; acc_name: string | null; asset_name?: string; asset_color?: string }
export interface Goal { id: number; name: string; target_cents: number; saved_cents: number; deadline: string | null; color: string; asset_id: number | null; created_at: string; completed_at: string | null; progress_cents: number; asset_name: string | null }

export const ASSET_TYPES: { id: AssetType; label: string }[] = [
  { id: 'rf', label: 'Renda fixa' },
  { id: 'tesouro', label: 'Tesouro' },
  { id: 'acoes', label: 'Ações' },
  { id: 'fii', label: 'FIIs' },
  { id: 'cripto', label: 'Cripto' },
  { id: 'prev', label: 'Previdência' },
  { id: 'outro', label: 'Outro' },
];
export const assetTypeLabel = (t: string) => ASSET_TYPES.find((a) => a.id === t)?.label ?? 'Outro';

// ───────────────────────── Recorrência ─────────────────────────
/** Rótulo "5/12", "∞" ou "até DEZ/27". */
export function recurrenceBadge(t: Pick<Tx, 'rec_mode' | 'rec_total' | 'rec_first' | 'seq'>): string | null {
  if (!t.rec_mode || t.seq == null) return null;
  if (t.rec_mode === 'count') return `${(t.rec_first ?? 1) + t.seq - 1}/${t.rec_total}`;
  if (t.rec_mode === 'until') return `${t.seq}x`;
  return '∞';
}

function occurrenceCount(r: Recurrence, horizon: string): number {
  const startYm = monthOf(r.start_date);
  let n: number;
  if (r.mode === 'count') n = (r.total ?? 1) - (r.first_number - 1);
  else if (r.mode === 'until') n = monthDiff(startYm, r.until_month ?? startYm) + 1;
  else n = monthDiff(startYm, horizon) + 1;
  if (r.end_seq != null) n = Math.min(n, r.end_seq);
  return Math.max(0, n);
}

function occurrenceDate(r: Recurrence, seq: number): string {
  const ym = addMonths(monthOf(r.start_date), seq - 1);
  return dateInMonth(ym, Number(r.start_date.slice(8, 10)));
}

/** Cria as ocorrências que ainda não existem (as "puladas" ficam como 'skipped' e não voltam). */
function materialize(r: Recurrence, pastDone = false) {
  const horizon = addMonths(thisMonth(), 12);
  const n = occurrenceCount(r, horizon);
  const today = todayISO();
  const now = nowISO();
  for (let seq = 1; seq <= n; seq++) {
    const date = occurrenceDate(r, seq);
    const status: Status = pastDone && date <= today ? 'done' : 'planned';
    run(
      `INSERT OR IGNORE INTO transactions (kind, amount_cents, description, category_id, account_id, date, status, recurrence_id, seq, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.kind, r.amount_cents, r.description, r.category_id, r.account_id, date, status, r.id, seq, now],
    );
  }
}

/** Chamado ao abrir o app: estende recorrências sem fim até 12 meses à frente. */
export function extendRecurrences() {
  const recs = all<Recurrence>("SELECT * FROM recurrences WHERE mode = 'forever'");
  if (!recs.length) return;
  tx(() => recs.forEach((r) => materialize(r)));
}

// ───────────────────────── Lançamentos ─────────────────────────
export type Repeat =
  | { mode: 'none' }
  | { mode: 'forever' }
  | { mode: 'count'; total: number; first: number }
  | { mode: 'until'; until: string };

export interface EntryInput {
  kind: Kind; amount_cents: number; description: string; category_id: number | null; account_id: number | null;
  date: string; status: 'planned' | 'done'; repeat: Repeat;
}

export function addEntry(e: EntryInput): { recurring: boolean } {
  const now = nowISO();
  if (e.repeat.mode === 'none') {
    run(
      `INSERT INTO transactions (kind, amount_cents, description, category_id, account_id, date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.kind, e.amount_cents, e.description, e.category_id, e.account_id, e.date, e.status, now],
    );
    return { recurring: false };
  }
  const rp = e.repeat;
  tx(() => {
    const res = run(
      `INSERT INTO recurrences (kind, amount_cents, description, category_id, account_id, start_date, mode, total, first_number, until_month, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.kind, e.amount_cents, e.description, e.category_id, e.account_id, e.date, rp.mode,
        rp.mode === 'count' ? rp.total : null,
        rp.mode === 'count' ? rp.first : 1,
        rp.mode === 'until' ? rp.until : null,
        now,
      ],
    );
    const r = first<Recurrence>('SELECT * FROM recurrences WHERE id = ?', [res.lastInsertRowId])!;
    materialize(r, e.status === 'done');
  });
  return { recurring: true };
}

const TX_SELECT = `
  SELECT t.*, c.name AS cat_name, c.code AS cat_code, c.color AS cat_color, a.name AS acc_name,
         r.mode AS rec_mode, r.total AS rec_total, r.first_number AS rec_first, r.until_month AS rec_until
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN recurrences r ON r.id = t.recurrence_id`;

export const getTx = (id: number) => first<Tx>(`${TX_SELECT} WHERE t.id = ?`, [id]);

export function listMonth(ym: string): Tx[] {
  return all<Tx>(`${TX_SELECT} WHERE t.status != 'skipped' AND substr(t.date, 1, 7) = ? ORDER BY t.date DESC, t.id DESC`, [ym]);
}

export function pending(): Tx[] {
  return all<Tx>(`${TX_SELECT} WHERE t.status = 'planned' AND t.date <= ? ORDER BY t.date ASC, t.id ASC`, [todayISO()]);
}

export function upcoming(days = 7): Tx[] {
  const t = todayISO();
  return all<Tx>(`${TX_SELECT} WHERE t.status = 'planned' AND t.date > ? AND t.date <= ? ORDER BY t.date ASC, t.id ASC`, [t, addDays(t, days)]);
}

export function setStatus(id: number, status: 'planned' | 'done') {
  run('UPDATE transactions SET status = ? WHERE id = ?', [status, id]);
}

export interface TxPatch { kind: Kind; amount_cents: number; description: string; category_id: number | null; account_id: number | null; date: string; status: 'planned' | 'done' }

export function updateTx(id: number, p: TxPatch, scope: Scope) {
  const t = first<Tx>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (!t) return;
  tx(() => {
    if (scope === 'one' || t.recurrence_id == null) {
      run(
        'UPDATE transactions SET kind=?, amount_cents=?, description=?, category_id=?, account_id=?, date=?, status=? WHERE id=?',
        [p.kind, p.amount_cents, p.description, p.category_id, p.account_id, p.date, p.status, id],
      );
      return;
    }
    const fromSeq = scope === 'all' ? 1 : t.seq ?? 1;
    run(
      'UPDATE recurrences SET kind=?, amount_cents=?, description=?, category_id=?, account_id=? WHERE id=?',
      [p.kind, p.amount_cents, p.description, p.category_id, p.account_id, t.recurrence_id],
    );
    run(
      `UPDATE transactions SET kind=?, amount_cents=?, description=?, category_id=?, account_id=?
       WHERE recurrence_id=? AND seq>=? AND status != 'skipped'`,
      [p.kind, p.amount_cents, p.description, p.category_id, p.account_id, t.recurrence_id, fromSeq],
    );
    // status/data da ocorrência atual
    run('UPDATE transactions SET status=?, date=? WHERE id=?', [p.status, p.date, id]);
  });
}

export function deleteTx(id: number, scope: Scope) {
  const t = first<Tx>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (!t) return;
  tx(() => {
    if (t.recurrence_id == null) {
      run('DELETE FROM transactions WHERE id = ?', [id]);
    } else if (scope === 'one') {
      run("UPDATE transactions SET status = 'skipped' WHERE id = ?", [id]);
    } else if (scope === 'future' && (t.seq ?? 1) > 1) {
      run('DELETE FROM transactions WHERE recurrence_id = ? AND seq >= ?', [t.recurrence_id, t.seq]);
      run('UPDATE recurrences SET end_seq = ? WHERE id = ?', [(t.seq ?? 1) - 1, t.recurrence_id]);
    } else {
      run('DELETE FROM transactions WHERE recurrence_id = ?', [t.recurrence_id]);
      run('DELETE FROM recurrences WHERE id = ?', [t.recurrence_id]);
    }
  });
}

// ───────────────────────── Contas e categorias ─────────────────────────
export function accounts(includeArchived = false): Account[] {
  return all<Account>(
    `SELECT a.*, a.initial_cents
       + COALESCE((SELECT SUM(CASE WHEN t.kind = 'income' THEN t.amount_cents ELSE -t.amount_cents END)
                   FROM transactions t WHERE t.account_id = a.id AND t.status = 'done'), 0)
       + COALESCE((SELECT SUM(CASE WHEN m.kind = 'resgate' THEN m.amount_cents ELSE -m.amount_cents END)
                   FROM asset_moves m WHERE m.account_id = a.id), 0) AS balance
     FROM accounts a ${includeArchived ? '' : 'WHERE a.archived = 0'} ORDER BY a.id`,
  );
}

export function saveAccount(a: { id?: number; name: string; color: string; initial_cents: number }) {
  if (a.id) run('UPDATE accounts SET name=?, color=?, initial_cents=? WHERE id=?', [a.name, a.color, a.initial_cents, a.id]);
  else run('INSERT INTO accounts (name, color, initial_cents, created_at) VALUES (?, ?, ?, ?)', [a.name, a.color, a.initial_cents, nowISO()]);
}

/** Exclui se não tiver movimento; caso contrário arquiva. Retorna o que fez. */
export function removeAccount(id: number): 'deleted' | 'archived' {
  const used = first<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM transactions WHERE account_id = ?) + (SELECT COUNT(*) FROM asset_moves WHERE account_id = ?) AS n',
    [id, id],
  );
  if (used && used.n > 0) {
    run('UPDATE accounts SET archived = 1 WHERE id = ?', [id]);
    return 'archived';
  }
  run('DELETE FROM accounts WHERE id = ?', [id]);
  return 'deleted';
}

export function categories(kind?: Kind): Category[] {
  return kind
    ? all<Category>('SELECT * FROM categories WHERE archived = 0 AND kind = ? ORDER BY id', [kind])
    : all<Category>('SELECT * FROM categories WHERE archived = 0 ORDER BY kind DESC, id');
}

export function saveCategory(c: { id?: number; name: string; kind: Kind; code: string; color: string; budget_cents: number | null }) {
  if (c.id) run('UPDATE categories SET name=?, kind=?, code=?, color=?, budget_cents=? WHERE id=?', [c.name, c.kind, c.code, c.color, c.budget_cents, c.id]);
  else run('INSERT INTO categories (name, kind, code, color, budget_cents) VALUES (?, ?, ?, ?, ?)', [c.name, c.kind, c.code, c.color, c.budget_cents]);
}

export function removeCategory(id: number) {
  run('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
}

// ───────────────────────── Resumos ─────────────────────────
export interface MonthSummary { incDone: number; incPlan: number; expDone: number; expPlan: number; invested: number }

export function monthSummary(ym: string): MonthSummary {
  const r = first<{ incDone: number; incPlan: number; expDone: number; expPlan: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind='income' AND status='done' THEN amount_cents END), 0) AS incDone,
       COALESCE(SUM(CASE WHEN kind='income' AND status='planned' THEN amount_cents END), 0) AS incPlan,
       COALESCE(SUM(CASE WHEN kind='expense' AND status='done' THEN amount_cents END), 0) AS expDone,
       COALESCE(SUM(CASE WHEN kind='expense' AND status='planned' THEN amount_cents END), 0) AS expPlan
     FROM transactions WHERE substr(date, 1, 7) = ?`,
    [ym],
  )!;
  const inv = first<{ v: number }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='aporte' THEN amount_cents ELSE -amount_cents END), 0) AS v
     FROM asset_moves WHERE substr(date, 1, 7) = ? AND account_id IS NOT NULL`,
    [ym],
  )!;
  return { ...r, invested: inv.v };
}

export interface Totals { received: number; spent: number; invested: number; inAccounts: number; inAssets: number; netWorth: number }

export function totals(): Totals {
  const r = first<{ received: number; spent: number }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount_cents END), 0) AS received,
            COALESCE(SUM(CASE WHEN kind='expense' THEN amount_cents END), 0) AS spent
     FROM transactions WHERE status = 'done'`,
  )!;
  const inv = first<{ v: number }>("SELECT COALESCE(SUM(CASE WHEN kind='aporte' THEN amount_cents ELSE -amount_cents END), 0) AS v FROM asset_moves")!;
  const acc = first<{ v: number }>(
    `SELECT COALESCE(SUM(initial_cents), 0)
       + COALESCE((SELECT SUM(CASE WHEN kind='income' THEN amount_cents ELSE -amount_cents END) FROM transactions WHERE status='done' AND account_id IS NOT NULL), 0)
       + COALESCE((SELECT SUM(CASE WHEN kind='resgate' THEN amount_cents ELSE -amount_cents END) FROM asset_moves WHERE account_id IS NOT NULL), 0) AS v
     FROM accounts`,
  )!;
  const assetsV = first<{ v: number }>('SELECT COALESCE(SUM(current_cents), 0) AS v FROM assets WHERE archived = 0')!;
  return { received: r.received, spent: r.spent, invested: inv.v, inAccounts: acc.v, inAssets: assetsV.v, netWorth: acc.v + assetsV.v };
}

/** Saldo previsto no fim do mês atual (saldo real + previstos até o fim do mês). */
export function projectedEndOfMonth(): number {
  const ym = thisMonth();
  const end = dateInMonth(ym, 31);
  const r = first<{ v: number }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount_cents ELSE -amount_cents END), 0) AS v
     FROM transactions WHERE status='planned' AND date <= ?`,
    [end],
  )!;
  return totals().inAccounts + r.v;
}

export interface FlowPoint { ym: string; inc: number; exp: number }
export function flowHistory(endYm: string, months = 6): FlowPoint[] {
  const start = addMonths(endYm, -(months - 1));
  const rows = all<FlowPoint>(
    `SELECT substr(date, 1, 7) AS ym,
       COALESCE(SUM(CASE WHEN kind='income' THEN amount_cents END), 0) AS inc,
       COALESCE(SUM(CASE WHEN kind='expense' THEN amount_cents END), 0) AS exp
     FROM transactions WHERE status != 'skipped' AND substr(date, 1, 7) BETWEEN ? AND ? GROUP BY ym`,
    [start, endYm],
  );
  const map = new Map(rows.map((r) => [r.ym, r]));
  return Array.from({ length: months }, (_, i) => {
    const ym = addMonths(start, i);
    return map.get(ym) ?? { ym, inc: 0, exp: 0 };
  });
}

export interface Budget { id: number; name: string; code: string; color: string; budget: number; spent: number; planned: number }
export function budgets(ym: string): Budget[] {
  return all<Budget>(
    `SELECT c.id, c.name, c.code, c.color, c.budget_cents AS budget,
       COALESCE((SELECT SUM(amount_cents) FROM transactions t WHERE t.category_id=c.id AND t.status='done' AND substr(t.date,1,7)=?), 0) AS spent,
       COALESCE((SELECT SUM(amount_cents) FROM transactions t WHERE t.category_id=c.id AND t.status='planned' AND substr(t.date,1,7)=?), 0) AS planned
     FROM categories c WHERE c.archived=0 AND c.kind='expense' AND c.budget_cents > 0 ORDER BY c.id`,
    [ym, ym],
  );
}

export interface CatSpend { id: number; name: string; code: string; color: string; total: number }
export function spendByCategory(ym: string): CatSpend[] {
  return all<CatSpend>(
    `SELECT c.id, c.name, c.code, c.color, SUM(t.amount_cents) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.kind='expense' AND t.status != 'skipped' AND substr(t.date,1,7)=?
     GROUP BY c.id ORDER BY total DESC`,
    [ym],
  );
}

// ───────────────────────── Investimentos ─────────────────────────
const ASSET_SELECT = `SELECT s.*, COALESCE((SELECT SUM(CASE WHEN m.kind='aporte' THEN m.amount_cents ELSE -m.amount_cents END) FROM asset_moves m WHERE m.asset_id = s.id), 0) AS invested FROM assets s`;

export const assets = () => all<Asset>(`${ASSET_SELECT} WHERE s.archived = 0 ORDER BY s.current_cents DESC`);
export const getAsset = (id: number) => first<Asset>(`${ASSET_SELECT} WHERE s.id = ?`, [id]);

export function saveAsset(a: { id?: number; name: string; type: AssetType; color: string }, initial?: { amount_cents: number; date: string }) {
  const now = nowISO();
  if (a.id) {
    run('UPDATE assets SET name=?, type=?, color=? WHERE id=?', [a.name, a.type, a.color, a.id]);
    return a.id;
  }
  let id = 0;
  tx(() => {
    const res = run('INSERT INTO assets (name, type, color, current_cents, updated_at, created_at) VALUES (?, ?, ?, 0, ?, ?)', [a.name, a.type, a.color, now, now]);
    id = res.lastInsertRowId;
    if (initial && initial.amount_cents > 0) {
      // posição já existente: conta como investido, sem tirar de nenhuma conta
      run("INSERT INTO asset_moves (asset_id, kind, amount_cents, account_id, date, note, created_at) VALUES (?, 'aporte', ?, NULL, ?, 'Saldo inicial', ?)", [id, initial.amount_cents, initial.date, now]);
      run('UPDATE assets SET current_cents = ? WHERE id = ?', [initial.amount_cents, id]);
    }
  });
  return id;
}

export function deleteAsset(id: number) {
  tx(() => {
    run('DELETE FROM asset_moves WHERE asset_id = ?', [id]);
    run('UPDATE goals SET asset_id = NULL WHERE asset_id = ?', [id]);
    run('DELETE FROM assets WHERE id = ?', [id]);
  });
}

export function assetMove(m: { asset_id: number; kind: 'aporte' | 'resgate'; amount_cents: number; account_id: number | null; date: string; note?: string }) {
  const now = nowISO();
  tx(() => {
    run('INSERT INTO asset_moves (asset_id, kind, amount_cents, account_id, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [m.asset_id, m.kind, m.amount_cents, m.account_id, m.date, m.note ?? '', now]);
    const delta = m.kind === 'aporte' ? m.amount_cents : -m.amount_cents;
    run('UPDATE assets SET current_cents = MAX(0, current_cents + ?), updated_at = ? WHERE id = ?', [delta, now, m.asset_id]);
  });
}

export function deleteAssetMove(id: number) {
  const m = first<AssetMove>('SELECT * FROM asset_moves WHERE id = ?', [id]);
  if (!m) return;
  tx(() => {
    const delta = m.kind === 'aporte' ? -m.amount_cents : m.amount_cents;
    run('UPDATE assets SET current_cents = MAX(0, current_cents + ?) WHERE id = ?', [delta, m.asset_id]);
    run('DELETE FROM asset_moves WHERE id = ?', [id]);
  });
}

export function setAssetValue(id: number, cents: number) {
  run('UPDATE assets SET current_cents = ?, updated_at = ? WHERE id = ?', [cents, nowISO(), id]);
}

export function assetMoves(assetId: number): AssetMove[] {
  return all<AssetMove>(
    'SELECT m.*, a.name AS acc_name FROM asset_moves m LEFT JOIN accounts a ON a.id = m.account_id WHERE m.asset_id = ? ORDER BY m.date DESC, m.id DESC',
    [assetId],
  );
}

export function movesInMonth(ym: string): AssetMove[] {
  return all<AssetMove>(
    `SELECT m.*, a.name AS acc_name, s.name AS asset_name, s.color AS asset_color FROM asset_moves m
     LEFT JOIN accounts a ON a.id = m.account_id JOIN assets s ON s.id = m.asset_id
     WHERE substr(m.date, 1, 7) = ? ORDER BY m.date DESC, m.id DESC`,
    [ym],
  );
}

// ───────────────────────── Metas ─────────────────────────
const GOAL_SELECT = `SELECT g.*, s.name AS asset_name,
  CASE WHEN g.asset_id IS NOT NULL THEN COALESCE(s.current_cents, 0) ELSE g.saved_cents END AS progress_cents
  FROM goals g LEFT JOIN assets s ON s.id = g.asset_id`;

export const goals = () => all<Goal>(`${GOAL_SELECT} ORDER BY (g.completed_at IS NOT NULL), g.deadline IS NULL, g.deadline, g.id`);
export const getGoal = (id: number) => first<Goal>(`${GOAL_SELECT} WHERE g.id = ?`, [id]);

export function saveGoal(g: { id?: number; name: string; target_cents: number; deadline: string | null; color: string; asset_id: number | null }, initialSaved = 0) {
  if (g.id) {
    run('UPDATE goals SET name=?, target_cents=?, deadline=?, color=?, asset_id=? WHERE id=?', [g.name, g.target_cents, g.deadline, g.color, g.asset_id, g.id]);
    return g.id;
  }
  const res = run('INSERT INTO goals (name, target_cents, saved_cents, deadline, color, asset_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [g.name, g.target_cents, initialSaved, g.deadline, g.color, g.asset_id, nowISO()]);
  return res.lastInsertRowId;
}

export function goalDeposit(id: number, cents: number) {
  tx(() => {
    run('INSERT INTO goal_moves (goal_id, amount_cents, date, created_at) VALUES (?, ?, ?, ?)', [id, cents, todayISO(), nowISO()]);
    run('UPDATE goals SET saved_cents = MAX(0, saved_cents + ?) WHERE id = ?', [cents, id]);
  });
}

/** Marca como concluída as metas que bateram o alvo; retorna as recém-concluídas. */
export function settleGoals(): Goal[] {
  const done = all<Goal>(`${GOAL_SELECT} WHERE g.completed_at IS NULL`).filter((g) => g.progress_cents >= g.target_cents && g.target_cents > 0);
  done.forEach((g) => run('UPDATE goals SET completed_at = ? WHERE id = ?', [nowISO(), g.id]));
  return done;
}

export function reopenGoal(id: number) {
  run('UPDATE goals SET completed_at = NULL WHERE id = ?', [id]);
}

export function deleteGoal(id: number) {
  tx(() => {
    run('DELETE FROM goal_moves WHERE goal_id = ?', [id]);
    run('DELETE FROM goals WHERE id = ?', [id]);
  });
}

// ───────────────────────── Backup ─────────────────────────
export function exportAll() {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = all(`SELECT * FROM ${t}`);
  return { app: 'XPVault', format: 1, exported_at: nowISO(), tables };
}

export function importAll(data: unknown) {
  const d = data as { app?: string; tables?: Record<string, Record<string, unknown>[]> };
  if (!d || d.app !== 'XPVault' || !d.tables) throw new Error('Arquivo não é um backup do XPVault.');
  const tables = d.tables;
  tx(() => {
    for (const t of TABLES) {
      run(`DELETE FROM ${t}`);
      const rows = tables[t] ?? [];
      for (const row of rows) {
        const cols = Object.keys(row).filter((k) => /^[a-z_]+$/.test(k));
        if (!cols.length) continue;
        const values = cols.map((c) => row[c] as string | number | null);
        db.runSync(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, values);
      }
    }
  });
}

export function wipeAll() {
  tx(() => {
    for (const t of TABLES) run(`DELETE FROM ${t}`);
  });
}

export function counts() {
  return first<{ txs: number; recs: number; invests: number; goals: number; goalsDone: number }>(
    `SELECT (SELECT COUNT(*) FROM transactions WHERE status != 'skipped') AS txs,
            (SELECT COUNT(*) FROM recurrences) AS recs,
            (SELECT COUNT(*) FROM asset_moves WHERE kind='aporte' AND account_id IS NOT NULL) AS invests,
            (SELECT COUNT(*) FROM goals) AS goals,
            (SELECT COUNT(*) FROM goals WHERE completed_at IS NOT NULL) AS goalsDone`,
  )!;
}
