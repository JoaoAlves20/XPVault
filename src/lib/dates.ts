// Datas como strings locais: 'YYYY-MM-DD' (dia) e 'YYYY-MM' (mês).

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => toISO(new Date());
export const nowISO = () => new Date().toISOString();
export const monthOf = (iso: string) => iso.slice(0, 7);
export const thisMonth = () => monthOf(todayISO());

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** Quantos meses de `a` até `b` (b - a). */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function dateInMonth(ym: string, day: number): string {
  return `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthLabel = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;
export const monthShort = (ym: string) => `${MONTHS_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

export function relDay(iso: string): string | null {
  const t = todayISO();
  if (iso === t) return 'HOJE';
  if (iso === addDays(t, -1)) return 'ONTEM';
  if (iso === addDays(t, 1)) return 'AMANHÃ';
  return null;
}

/** "SEG 23 NOV" */
export function dayLabel(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "23/11" ou "23/11/25" se de outro ano. */
export function shortDate(iso: string): string {
  const y = iso.slice(0, 4);
  const base = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return y === todayISO().slice(0, 4) ? base : `${base}/${y.slice(2)}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}
