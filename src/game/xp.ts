import { all, first, run } from '../db/db';
import { addDays, nowISO, todayISO } from '../lib/dates';
import { fx } from './fx';

// Nível L exige 50·L·(L−1) XP acumulado: N2=100, N3=300, N4=600, N5=1000, N10=4500…
export const xpForLevel = (l: number) => 50 * l * (l - 1);

export function levelFromXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

const RANKS: [number, string][] = [
  [1, 'Recruta'],
  [3, 'Aprendiz'],
  [5, 'Guardião'],
  [8, 'Estrategista'],
  [12, 'Mestre do Cofre'],
  [17, 'Lenda'],
];
export function rankFor(level: number): string {
  let r = RANKS[0][1];
  for (const [l, name] of RANKS) if (level >= l) r = name;
  return r;
}
export const nextRank = (level: number) => RANKS.find(([l]) => l > level) ?? null;

export const totalXp = () => first<{ v: number }>('SELECT COALESCE(SUM(xp), 0) AS v FROM xp_events')!.v;

export interface LevelInfo { xp: number; level: number; rank: string; floor: number; ceil: number; progress: number }
export function levelInfo(): LevelInfo {
  const xp = totalXp();
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { xp, level, rank: rankFor(level), floor, ceil, progress: (xp - floor) / (ceil - floor) };
}

/** Dias seguidos com pelo menos um registro (conta a partir de hoje ou de ontem). */
export function streak(): number {
  const days = all<{ day: string }>("SELECT DISTINCT day FROM xp_events WHERE kind = 'log' ORDER BY day DESC LIMIT 400").map((d) => d.day);
  if (!days.length) return 0;
  const set = new Set(days);
  let cur = todayISO();
  if (!set.has(cur)) cur = addDays(cur, -1);
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

export type XpKind = 'log' | 'confirm' | 'invest' | 'goal' | 'goal_done' | 'streak' | 'achievement';

/** Registra XP e dispara os efeitos (toast e level up). */
export function award(kind: XpKind, xp: number, label: string) {
  if (xp <= 0) return;
  const before = levelFromXp(totalXp());
  const day = todayISO();
  const now = nowISO();
  let bonus = 0;
  if (kind === 'log') {
    const already = first<{ n: number }>("SELECT COUNT(*) AS n FROM xp_events WHERE kind = 'log' AND day = ?", [day])!.n;
    if (!already) {
      run("INSERT INTO xp_events (kind, xp, note, day, created_at) VALUES ('log', ?, ?, ?, ?)", [xp, label, day, now]);
      const s = streak();
      bonus = s > 1 ? Math.min(30, s * 3) : 0;
      if (bonus) run("INSERT INTO xp_events (kind, xp, note, day, created_at) VALUES ('streak', ?, ?, ?, ?)", [bonus, `Sequência de ${s} dias`, day, now]);
    } else {
      run("INSERT INTO xp_events (kind, xp, note, day, created_at) VALUES ('log', ?, ?, ?, ?)", [xp, label, day, now]);
    }
  } else {
    run('INSERT INTO xp_events (kind, xp, note, day, created_at) VALUES (?, ?, ?, ?, ?)', [kind, xp, label, day, now]);
  }
  fx.emit({ type: 'xp', amount: xp + bonus, label: bonus ? `${label} · sequência!` : label });
  const after = levelFromXp(totalXp());
  if (after > before) fx.emit({ type: 'level', level: after, rank: rankFor(after) });
}

export const XP_RULES = [
  ['Registrar receita ou despesa', '+10'],
  ['Confirmar algo previsto', '+5'],
  ['Fazer um aporte', '+25 a +75'],
  ['Guardar para uma missão', '+15'],
  ['Concluir uma missão', '+150'],
  ['Dias seguidos registrando', 'até +30/dia'],
  ['Desbloquear conquista', '+50'],
] as const;
