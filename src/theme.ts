// XPVault design tokens — "HUD de cofre": preto profundo, ouro de XP e cores de status.
export const C = {
  bg: '#07080B',
  bg2: '#0C0E13',
  panel: '#10131A',
  panelHi: '#161A24',
  line: '#222838',
  lineHi: '#333B50',
  text: '#ECEFF5',
  sub: '#A0A8BC',
  mute: '#5F6780',

  gold: '#FFC94A',
  goldDeep: '#C8901C',
  income: '#B4F25A',
  expense: '#FF5C7A',
  invest: '#45D3FF',
  goal: '#B79BFF',
  warn: '#FF9F43',
};

export const F = {
  reg: 'SpaceGrotesk_400Regular',
  med: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

// Paleta para categorias, contas, ativos e metas.
export const SWATCHES = [
  '#FFC94A', '#B4F25A', '#45D3FF', '#FF5C7A', '#B79BFF', '#FF9F43',
  '#3DF5B0', '#FF7AD9', '#7AA2FF', '#E8E36B', '#9AA3B8', '#FF6B3D',
];

export const kindColor = (k: 'income' | 'expense' | 'invest') =>
  k === 'income' ? C.income : k === 'expense' ? C.expense : C.invest;

export const alpha = (hex: string, a: number) => {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? hex + v : hex;
};
