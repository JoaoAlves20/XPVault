// Barramento de efeitos visuais (toasts de XP, level up, conquistas).
export type FxEvent =
  | { type: 'xp'; amount: number; label: string }
  | { type: 'level'; level: number; rank: string }
  | { type: 'achievement'; title: string; desc: string }
  | { type: 'toast'; text: string; color?: string };

const listeners = new Set<(e: FxEvent) => void>();

export const fx = {
  emit(e: FxEvent) {
    listeners.forEach((l) => l(e));
  },
  on(l: (e: FxEvent) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export const toast = (text: string, color?: string) => fx.emit({ type: 'toast', text, color });
