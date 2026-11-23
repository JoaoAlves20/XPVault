// Valores sempre em centavos (inteiros) para evitar erro de ponto flutuante.

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function fmt(cents: number, opts: { sign?: boolean; compact?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, compact = false, symbol = true } = opts;
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  let body: string;
  if (compact && abs >= 1_000_000) {
    // >= R$ 10.000
    const v = abs / 100;
    body = v >= 1_000_000
      ? (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace('.', ',') + 'M'
      : (v / 1000).toFixed(v >= 100_000 ? 0 : 1).replace('.', ',') + 'k';
  } else {
    body = group(Math.floor(abs / 100)) + ',' + String(abs % 100).padStart(2, '0');
  }
  const s = neg ? '-' : sign && abs > 0 ? '+' : '';
  return `${s}${symbol ? 'R$ ' : ''}${body}`;
}

/** Converte texto digitado ("1.234,56", "1234.5", "12") em centavos. */
export function parseCents(text: string): number {
  const t = text.trim().replace(/[^\d,.-]/g, '');
  if (!t) return 0;
  let normalized = t;
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.');
  const v = Number(normalized);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

export const pct = (v: number, digits = 1) =>
  `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits).replace('.', ',')}%`;
