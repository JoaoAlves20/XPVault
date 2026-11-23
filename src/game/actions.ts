// Ações de alto nível usadas pelas telas: gravam no banco, dão XP, checam conquistas e atualizam a UI.
import * as Haptics from 'expo-haptics';
import * as R from '../db/repo';
import { bump } from '../db/store';
import { initDb } from '../db/db';
import { award } from './xp';
import { checkAchievements } from './achievements';

const buzz = (kind: 'ok' | 'light' | 'warn' = 'ok') => {
  try {
    if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // sem vibração disponível
  }
};
export { buzz };

function afterWrite() {
  for (const g of R.settleGoals()) award('goal_done', 150, `Missão cumprida: ${g.name}`);
  checkAchievements();
  bump();
}

export function addEntry(e: R.EntryInput) {
  const res = R.addEntry(e);
  award('log', 10, e.kind === 'income' ? 'Receita registrada' : 'Despesa registrada');
  buzz();
  afterWrite();
  return res;
}

export function updateEntry(id: number, p: R.TxPatch, scope: R.Scope) {
  R.updateTx(id, p, scope);
  buzz('light');
  afterWrite();
}

export function deleteEntry(id: number, scope: R.Scope) {
  R.deleteTx(id, scope);
  buzz('warn');
  bump();
}

export function confirmEntry(id: number) {
  R.setStatus(id, 'done');
  award('confirm', 5, 'Confirmado');
  buzz();
  afterWrite();
}

export function unconfirmEntry(id: number) {
  R.setStatus(id, 'planned');
  buzz('light');
  bump();
}

export function investMove(m: Parameters<typeof R.assetMove>[0]) {
  R.assetMove(m);
  if (m.kind === 'aporte') {
    const bonus = Math.min(50, Math.floor(m.amount_cents / 10000) * 5); // +5 a cada R$ 100
    award('invest', 25 + bonus, 'Aporte feito');
  }
  buzz();
  afterWrite();
}

export function goalDeposit(id: number, cents: number) {
  R.goalDeposit(id, cents);
  if (cents > 0) award('goal', 15, 'Guardado na missão');
  buzz();
  afterWrite();
}

/** Para gravações simples (cadastros) sem XP. */
export function write<T>(fn: () => T): T {
  const r = fn();
  afterWrite();
  return r;
}

export function resetAll() {
  R.wipeAll();
  initDb();
  bump();
}

export function restore(data: unknown) {
  R.importAll(data);
  initDb();
  R.extendRecurrences();
  bump();
}
