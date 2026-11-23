import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import { relDay, shortDate } from '../lib/dates';
import { recurrenceBadge, Tx, AssetMove } from '../db/repo';
import { CodeTile, Press } from './kit';
import { Icon } from './Icon';

export function TxRow({ tx, onPress, onConfirm, showDate }: { tx: Tx; onPress: () => void; onConfirm?: () => void; showDate?: boolean }) {
  const planned = tx.status === 'planned';
  const color = tx.kind === 'income' ? C.income : C.expense;
  const badge = recurrenceBadge(tx);
  const title = tx.description || tx.cat_name || (tx.kind === 'income' ? 'Receita' : 'Despesa');
  const meta = [showDate ? relDay(tx.date)?.toLowerCase() ?? shortDate(tx.date) : null, tx.cat_name && tx.description ? tx.cat_name : null, tx.acc_name].filter(Boolean).join(' · ');
  return (
    <Press onPress={onPress} scaleTo={0.985}>
      <View style={[styles.row, planned && styles.rowPlanned]}>
        <View style={[styles.stripe, { backgroundColor: planned ? alpha(color, 0.35) : color }]} />
        <CodeTile code={tx.cat_code ?? (tx.kind === 'income' ? 'REC' : 'DSP')} color={tx.cat_color ?? color} size={40} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, planned && { color: C.sub }]} numberOfLines={1}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {badge ? (
              <View style={styles.badge}>
                <Icon name="repeat" size={10} color={C.goal} stroke={2.4} />
                <Text style={[styles.badgeText, { color: C.goal }]}>{badge}</Text>
              </View>
            ) : null}
            {tx.acc_kind === 'benefit' ? (
              <View style={[styles.badge, { borderColor: alpha(C.sub, 0.5) }]}>
                <Text style={[styles.badgeText, { color: C.sub }]}>VALE</Text>
              </View>
            ) : null}
            {planned ? (
              <View style={[styles.badge, { borderColor: alpha(C.warn, 0.5) }]}>
                <Text style={[styles.badgeText, { color: C.warn }]}>PREVISTO</Text>
              </View>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: planned ? alpha(color, 0.65) : color }]}>
          {tx.kind === 'income' ? '+' : '−'}
          {fmt(tx.amount_cents, { symbol: false })}
        </Text>
        {onConfirm ? (
          <Press onPress={onConfirm} scaleTo={0.85}>
            <View style={[styles.confirm, { borderColor: color }]}>
              <Icon name="check" size={18} color={color} stroke={2.6} />
            </View>
          </Press>
        ) : null}
      </View>
    </Press>
  );
}

export function MoveRow({ mv, onPress }: { mv: AssetMove; onPress: () => void }) {
  const aporte = mv.kind === 'aporte';
  return (
    <Press onPress={onPress} scaleTo={0.985}>
      <View style={styles.row}>
        <View style={[styles.stripe, { backgroundColor: C.invest }]} />
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 26, height: 26, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: mv.asset_color ?? C.invest, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(mv.asset_color ?? C.invest, 0.14) }}>
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Icon name={aporte ? 'up' : 'down'} size={13} color={mv.asset_color ?? C.invest} stroke={2.6} />
            </View>
          </View>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title} numberOfLines={1}>{aporte ? 'Aporte' : 'Resgate'} · {mv.asset_name ?? 'Ativo'}</Text>
          <Text style={styles.meta} numberOfLines={1}>{mv.acc_name ? `${aporte ? 'de' : 'para'} ${mv.acc_name}` : mv.note || 'sem conta'}</Text>
        </View>
        <Text style={[styles.amount, { color: C.invest }]}>
          {aporte ? '◆ ' : '◇ '}
          {fmt(mv.amount_cents, { symbol: false })}
        </Text>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingRight: 12, paddingLeft: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  rowPlanned: { backgroundColor: C.bg2, borderStyle: 'dashed' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  title: { fontFamily: F.med, fontSize: 15, color: C.text },
  meta: { fontFamily: F.reg, fontSize: 12, color: C.mute, flexShrink: 1 },
  amount: { fontFamily: F.monoBold, fontSize: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: alpha(C.goal, 0.45), paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontFamily: F.monoBold, fontSize: 9.5, letterSpacing: 0.8 },
  confirm: { width: 36, height: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
});
