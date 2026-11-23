import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import { addMonths, dayLabel, monthLabel, MONTHS_SHORT, relDay, thisMonth } from '../lib/dates';
import { useQuery } from '../db/store';
import * as R from '../db/repo';
import { confirmEntry } from '../game/actions';
import { useNav } from '../nav';
import { DOCK_SPACE } from '../ui/chrome';
import { Appear, Chip, Empty, IconBtn, Panel, Row, SectionTitle, T } from '../ui/kit';
import { MoveRow, TxRow } from '../ui/rows';
import { buzz } from '../game/actions';

type Filter = 'all' | 'income' | 'expense' | 'invest' | 'planned' | 'benefit';
type Item = { k: 'tx'; date: string; id: number; tx: R.Tx } | { k: 'mv'; date: string; id: number; mv: R.AssetMove };

export function LedgerScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [ym, setYm] = useState(thisMonth());
  const [filter, setFilter] = useState<Filter>('all');

  const d = useQuery(
    () => ({
      txs: R.listMonth(ym),
      moves: R.movesInMonth(ym),
      sum: R.monthSummary(ym),
      flow: R.flowHistory(addMonths(ym, 1), 6),
      cats: R.spendByCategory(ym),
    }),
    [ym],
  );

  const groups = useMemo(() => {
    let items: Item[] = [
      ...d.txs.map((tx) => ({ k: 'tx' as const, date: tx.date, id: tx.id, tx })),
      ...d.moves.map((mv) => ({ k: 'mv' as const, date: mv.date, id: mv.id, mv })),
    ];
    items = items.filter((i) => {
      if (filter === 'all') return true;
      if (filter === 'invest') return i.k === 'mv';
      if (i.k !== 'tx') return false;
      if (filter === 'planned') return i.tx.status === 'planned';
      if (filter === 'benefit') return i.tx.acc_kind === 'benefit';
      return i.tx.kind === filter;
    });
    items.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
    const out: { date: string; items: Item[]; net: number }[] = [];
    for (const it of items) {
      let g = out[out.length - 1];
      if (!g || g.date !== it.date) {
        g = { date: it.date, items: [], net: 0 };
        out.push(g);
      }
      g.items.push(it);
      if (it.k === 'tx' && it.tx.acc_kind !== 'benefit') g.net += it.tx.kind === 'income' ? it.tx.amount_cents : -it.tx.amount_cents;
    }
    return out;
  }, [d, filter]);

  const inc = d.sum.incDone + d.sum.incPlan;
  const exp = d.sum.expDone + d.sum.expPlan;
  const maxFlow = Math.max(1, ...d.flow.map((f) => Math.max(f.inc, f.exp)));
  const catTotal = d.cats.reduce((s, c) => s + c.total, 0);

  const go = (n: number) => {
    buzz('light');
    setYm((m) => addMonths(m, n));
  };

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: DOCK_SPACE + insets.bottom + 10 }} showsVerticalScrollIndicator={false}>
      <Row>
        <View style={{ flex: 1 }}>
          <T v="label" color={C.gold}>Temporada</T>
          <Pressable onPress={() => setYm(thisMonth())}>
            <T v="h1">{monthLabel(ym)}</T>
          </Pressable>
        </View>
        <IconBtn icon="chevL" onPress={() => go(-1)} />
        <IconBtn icon="chevR" onPress={() => go(1)} />
      </Row>

      {/* Gráfico de fluxo */}
      <Appear key={`flow-${ym}`}>
        <Panel style={{ marginTop: 16 }} pad={14}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 6 }}>
            {d.flow.map((f) => {
              const sel = f.ym === ym;
              return (
                <Pressable key={f.ym} onPress={() => { buzz('light'); setYm(f.ym); }} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 76 }}>
                    <View style={{ width: 9, height: Math.max(2, (f.inc / maxFlow) * 76), backgroundColor: sel ? C.income : alpha(C.income, 0.35) }} />
                    <View style={{ width: 9, height: Math.max(2, (f.exp / maxFlow) * 76), backgroundColor: sel ? C.expense : alpha(C.expense, 0.35) }} />
                  </View>
                  <Text style={{ fontFamily: F.monoBold, fontSize: 9.5, letterSpacing: 0.8, color: sel ? C.gold : C.mute }}>{MONTHS_SHORT[Number(f.ym.slice(5, 7)) - 1]}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sumRow}>
            <Sum label="Entradas" value={inc} color={C.income} sub={d.sum.incPlan ? `${fmt(d.sum.incPlan, { compact: true })} prev.` : undefined} />
            <Sum label="Saídas" value={exp} color={C.expense} sub={d.sum.expPlan ? `${fmt(d.sum.expPlan, { compact: true })} prev.` : undefined} />
            <Sum label="Saldo" value={inc - exp} color={inc - exp >= 0 ? C.text : C.expense} />
          </View>
        </Panel>
      </Appear>

      {/* Onde foi o dinheiro */}
      {catTotal > 0 ? (
        <>
          <SectionTitle title="Onde foi o dinheiro" />
          <View style={{ flexDirection: 'row', height: 12, gap: 2 }}>
            {d.cats.map((c) => (
              <View key={c.id} style={{ flex: c.total, backgroundColor: c.color }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {d.cats.slice(0, 6).map((c) => (
              <Row key={c.id} gap={6}>
                <View style={{ width: 8, height: 8, backgroundColor: c.color }} />
                <Text style={{ fontFamily: F.med, fontSize: 12, color: C.sub }}>{c.name}</Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 12, color: C.text }}>{Math.round((c.total / catTotal) * 100)}%</Text>
              </Row>
            ))}
          </View>
        </>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <Chip label="Tudo" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Receitas" color={C.income} active={filter === 'income'} onPress={() => setFilter('income')} />
        <Chip label="Despesas" color={C.expense} active={filter === 'expense'} onPress={() => setFilter('expense')} />
        <Chip label="Aportes" color={C.invest} active={filter === 'invest'} onPress={() => setFilter('invest')} />
        <Chip label="Previstos" color={C.warn} active={filter === 'planned'} onPress={() => setFilter('planned')} />
        <Chip label="Vales" color={C.sub} active={filter === 'benefit'} onPress={() => setFilter('benefit')} />
      </ScrollView>

      {groups.length === 0 ? (
        <Empty title="Nada por aqui" text="Nenhum registro nesta temporada. Toque no losango dourado para registrar." icon="list" />
      ) : (
        groups.map((g, gi) => (
          <Appear key={`${ym}-${filter}-${g.date}`} delay={Math.min(gi, 8) * 40}>
            <View style={styles.dayHead}>
              <Text style={styles.dayText}>{dayLabel(g.date)}</Text>
              {relDay(g.date) ? <Text style={[styles.dayText, { color: C.gold }]}>· {relDay(g.date)}</Text> : null}
              <View style={{ flex: 1, height: 1, backgroundColor: C.line, marginHorizontal: 8 }} />
              {g.net !== 0 ? <Text style={[styles.dayText, { color: g.net > 0 ? C.income : C.expense }]}>{fmt(g.net, { sign: true, compact: true })}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              {g.items.map((it) =>
                it.k === 'tx' ? (
                  <TxRow
                    key={`t${it.id}`}
                    tx={it.tx}
                    onPress={() => nav.open({ t: 'tx', id: it.id })}
                    onConfirm={it.tx.status === 'planned' ? () => confirmEntry(it.id) : undefined}
                  />
                ) : (
                  <MoveRow key={`m${it.id}`} mv={it.mv} onPress={() => nav.open({ t: 'asset', id: it.mv.asset_id })} />
                ),
              )}
            </View>
          </Appear>
        ))
      )}
    </ScrollView>
  );
}

function Sum({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="label" color={C.mute} style={{ fontSize: 9.5 }}>{label}</T>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color, marginTop: 3 }} numberOfLines={1} adjustsFontSizeToFit>{fmt(value, { compact: true })}</Text>
      {sub ? <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.mute }}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sumRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 12, paddingTop: 12 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 8 },
  dayText: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 1.2, color: C.sub },
});
