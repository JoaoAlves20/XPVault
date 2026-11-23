import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, alpha } from '../theme';
import { fmt, pct } from '../lib/money';
import { daysBetween, todayISO } from '../lib/dates';
import { useQuery } from '../db/store';
import * as R from '../db/repo';
import { useNav } from '../nav';
import { DOCK_SPACE } from '../ui/chrome';
import { AnimatedNumber, Appear, Btn, Empty, Panel, Row, SectionTitle, T } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function VaultScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const d = useQuery(() => {
    const list = R.assets();
    const current = list.reduce((s, a) => s + a.current_cents, 0);
    const invested = list.reduce((s, a) => s + a.invested, 0);
    return { list, current, invested, month: R.monthSummary(todayISO().slice(0, 7)).invested };
  });
  const gain = d.current - d.invested;
  const gainPct = d.invested > 0 ? gain / d.invested : 0;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: DOCK_SPACE + insets.bottom + 10 }} showsVerticalScrollIndicator={false}>
      <T v="label" color={C.invest}>Cofre</T>
      <T v="h1">Investimentos</T>

      <Appear>
        <Panel accent={C.invest} style={{ marginTop: 16, gap: 14 }} stroke={alpha(C.invest, 0.3)}>
          <View>
            <T v="label" color={C.mute}>Valor atual</T>
            <AnimatedNumber value={d.current} duration={1000} style={{ fontFamily: F.monoBold, fontSize: 32, color: C.text, letterSpacing: -1, marginTop: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Mini label="Investido" value={fmt(d.invested, { compact: true })} color={C.invest} />
            <Mini label="Rendimento" value={fmt(gain, { sign: true, compact: true })} color={gain >= 0 ? C.income : C.expense} />
            <Mini label="Retorno" value={d.invested > 0 ? pct(gainPct) : '—'} color={gain >= 0 ? C.income : C.expense} />
          </View>
          {d.current > 0 ? (
            <View>
              <View style={{ flexDirection: 'row', height: 10, gap: 2 }}>
                {d.list.filter((a) => a.current_cents > 0).map((a) => (
                  <View key={a.id} style={{ flex: a.current_cents, backgroundColor: a.color }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                {d.list.filter((a) => a.current_cents > 0).map((a) => (
                  <Row key={a.id} gap={6}>
                    <View style={{ width: 8, height: 8, backgroundColor: a.color, transform: [{ rotate: '45deg' }] }} />
                    <Text style={{ fontFamily: F.med, fontSize: 12, color: C.sub }}>{a.name}</Text>
                    <Text style={{ fontFamily: F.monoBold, fontSize: 12, color: C.text }}>{Math.round((a.current_cents / d.current) * 100)}%</Text>
                  </Row>
                ))}
              </View>
            </View>
          ) : null}
        </Panel>
      </Appear>

      <Row style={{ marginTop: 14 }}>
        <Btn label="Aporte" icon="up" color={C.invest} onPress={() => nav.open({ t: 'add', mode: 'invest', moveKind: 'aporte' })} style={{ flex: 1 }} />
        <Btn label="Novo ativo" icon="plus" color={C.invest} variant="outline" onPress={() => nav.open({ t: 'assetEdit' })} style={{ flex: 1 }} />
      </Row>
      {d.month > 0 ? (
        <T v="small" color={C.sub} style={{ marginTop: 10, textAlign: 'center' }}>
          Neste mês você já guardou <Text style={{ color: C.invest, fontFamily: F.monoBold }}>{fmt(d.month)}</Text>
        </T>
      ) : null}

      <SectionTitle title={`Ativos · ${d.list.length}`} />
      {d.list.length === 0 ? (
        <Empty icon="vault" title="Cofre vazio" text="Cadastre onde seu dinheiro está aplicado (CDB, Tesouro, ações, cripto…). Aportes saem da conta mas não contam como gasto." />
      ) : (
        <View style={{ gap: 8 }}>
          {d.list.map((a, i) => {
            const g = a.current_cents - a.invested;
            const gp = a.invested > 0 ? g / a.invested : 0;
            const stale = daysBetween(a.updated_at.slice(0, 10), todayISO());
            return (
              <Appear key={a.id} delay={i * 50}>
                <Panel onPress={() => nav.open({ t: 'asset', id: a.id })} pad={14} c={12}>
                  <Row gap={12}>
                    <View style={[styles.gem, { borderColor: a.color, backgroundColor: alpha(a.color, 0.14) }]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3" numberOfLines={1}>{a.name}</T>
                      <T v="small" color={C.mute} style={{ fontSize: 12 }}>
                        {R.assetTypeLabel(a.type)} · {stale === 0 ? 'atualizado hoje' : `atualizado há ${stale}d`}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={{ fontFamily: F.monoBold, fontSize: 15, color: C.text }}>{fmt(a.current_cents, { compact: true })}</Text>
                      <Text style={{ fontFamily: F.monoBold, fontSize: 11.5, color: g >= 0 ? C.income : C.expense }}>
                        {a.invested > 0 ? pct(gp) : ''}
                      </Text>
                    </View>
                    <Icon name="chevR" size={16} color={C.mute} />
                  </Row>
                </Panel>
              </Appear>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, padding: 10 }}>
      <T v="label" color={C.mute} style={{ fontSize: 9 }}>{label}</T>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gem: { width: 22, height: 22, borderWidth: 2, transform: [{ rotate: '45deg' }], marginHorizontal: 6 },
});
