import { all, first, run } from '../db/db';
import { addMonths, nowISO, thisMonth } from '../lib/dates';
import { counts, monthSummary, totals, budgets } from '../db/repo';
import { streak, award } from './xp';
import { fx } from './fx';

export interface AchievementDef { code: string; title: string; desc: string; glyph: string; check: () => boolean }

const firstUseMonth = () => {
  const r = first<{ m: string | null }>("SELECT MIN(substr(date,1,7)) AS m FROM transactions WHERE status='done'");
  return r?.m ?? null;
};

/** Algum mês já fechado (anterior ao atual) que terminou no azul. */
function hadPositiveMonth(): boolean {
  const start = firstUseMonth();
  if (!start) return false;
  for (let ym = start; ym < thisMonth(); ym = addMonths(ym, 1)) {
    const s = monthSummary(ym);
    if (s.incDone > 0 && s.incDone > s.expDone) return true;
  }
  return false;
}

/** Mês anterior com orçamentos definidos e nenhum estourado. */
function keptBudgetLastMonth(): boolean {
  const prev = addMonths(thisMonth(), -1);
  const b = budgets(prev);
  const used = first<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE status='done' AND substr(date,1,7)=?", [prev])!.n;
  return b.length > 0 && used > 0 && b.every((x) => x.spent <= x.budget);
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'FIRST_LOG', title: 'Primeiro passo', desc: 'Faça seu primeiro registro.', glyph: '01', check: () => counts().txs >= 1 },
  { code: 'LOG_50', title: 'Escriba', desc: 'Chegue a 50 registros.', glyph: '50', check: () => counts().txs >= 50 },
  { code: 'LOG_250', title: 'Arquivista', desc: 'Chegue a 250 registros.', glyph: '250', check: () => counts().txs >= 250 },
  { code: 'AUTO', title: 'Piloto automático', desc: 'Crie seu primeiro lançamento recorrente.', glyph: '↻', check: () => counts().recs >= 1 },
  { code: 'STREAK_7', title: 'Semana em chamas', desc: 'Registre algo 7 dias seguidos.', glyph: '7D', check: () => streak() >= 7 },
  { code: 'STREAK_30', title: 'Disciplina de aço', desc: 'Registre algo 30 dias seguidos.', glyph: '30D', check: () => streak() >= 30 },
  { code: 'FIRST_INVEST', title: 'Semente', desc: 'Faça seu primeiro aporte.', glyph: '◆', check: () => counts().invests >= 1 },
  { code: 'INVEST_10K', title: 'Cinco dígitos', desc: 'Tenha R$ 10.000 investidos.', glyph: '10K', check: () => totals().inAssets >= 1_000_000 },
  { code: 'INVEST_100K', title: 'Cofre blindado', desc: 'Tenha R$ 100.000 investidos.', glyph: '100K', check: () => totals().inAssets >= 10_000_000 },
  { code: 'FIRST_GOAL', title: 'Missão aceita', desc: 'Crie sua primeira missão.', glyph: '⌖', check: () => counts().goals >= 1 },
  { code: 'GOAL_DONE', title: 'Missão cumprida', desc: 'Conclua uma missão.', glyph: '★', check: () => counts().goalsDone >= 1 },
  { code: 'POSITIVE_MONTH', title: 'Mês no azul', desc: 'Feche um mês recebendo mais do que gastou.', glyph: '+', check: hadPositiveMonth },
  { code: 'BUDGET_KEEPER', title: 'Orçamento intacto', desc: 'Feche um mês sem estourar nenhum orçamento.', glyph: 'HP', check: keptBudgetLastMonth },
];

export const unlocked = () => new Map(all<{ code: string; unlocked_at: string }>('SELECT * FROM achievements').map((a) => [a.code, a.unlocked_at]));

export function checkAchievements() {
  const have = unlocked();
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.code)) continue;
    let ok = false;
    try {
      ok = a.check();
    } catch {
      ok = false;
    }
    if (!ok) continue;
    run('INSERT OR IGNORE INTO achievements (code, unlocked_at) VALUES (?, ?)', [a.code, nowISO()]);
    fx.emit({ type: 'achievement', title: a.title, desc: a.desc });
    award('achievement', 50, `Conquista: ${a.title}`);
  }
}
