import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import { monthName, thisMonth } from '../lib/dates';
import { useQuery } from '../db/store';
import { getMeta } from '../db/db';
import * as R from '../db/repo';
import { levelInfo, streak } from '../game/xp';
import { confirmEntry } from '../game/actions';
import { useNav } from '../nav';
import { DOCK_SPACE } from '../ui/chrome';
import { AnimatedNumber, Appear, Btn, Chip, CodeTile, HexBadge, HPBar, IconBtn, Panel, Press, Ring, Row, SectionTitle, T, XPBar } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { TxRow } from '../ui/rows';

export function HomeScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<'month' | 'total'>('month');
  const ym = thisMonth();
  const d = useQuery(() => ({
    lvl: levelInfo(),
    streak: streak(),
    tot: R.totals(),
    month: R.monthSummary(ym),
    proj: R.projectedEndOfMonth(),
    pend: R.pending(),
    next: R.upcoming(7),
    budgets: R.budgets(ym),
    goal: R.goals().find((g) => !g.completed_at) ?? null,
    name: getMeta('player_name') ?? 'Jogador',
    count: R.counts().txs,
    reserved: R.reservedInGoals(),
    benefits: R.accounts().filter((a) => a.kind === 'benefit'),
  }));

  const monthNet = d.month.incDone - d.month.expDone;
  const free = d.tot.inAccounts - d.reserved;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: DOCK_SPACE + insets.bottom + 10 }} showsVerticalScrollIndicator={false}>
      {/* Cabeçalho do jogador */}
      <Appear>
        <Row gap={12}>
          <Press onPress={() => nav.setTab('quests')}>
            <HexBadge level={d.lvl.level} size={58} />
          </Press>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="label" color={C.gold}>NV {d.lvl.level} · {d.lvl.rank}</T>
            <T v="h2" numberOfLines={1}>{d.name}</T>
            <XPBar progress={d.lvl.progress} height={6} />
            <T v="small" color={C.mute} style={{ fontFamily: F.mono, fontSize: 11 }}>
              {d.lvl.xp - d.lvl.floor}/{d.lvl.ceil - d.lvl.floor} XP
            </T>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <IconBtn icon="sliders" onPress={() => nav.open({ t: 'settings' })} />
            <View style={[styles.streak, d.streak > 0 && { borderColor: alpha(C.warn, 0.6) }]}>
              <Icon name="flame" size={14} color={d.streak > 0 ? C.warn : C.mute} />
              <Text style={{ fontFamily: F.monoBold, fontSize: 12, color: d.streak > 0 ? C.warn : C.mute }}>{d.streak}</Text>
            </View>
          </View>
        </Row>
      </Appear>

      {/* Núcleo do cofre */}
      <Appear delay={80}>
        <VaultCore inAccounts={d.tot.inAccounts} inAssets={d.tot.inAssets} netWorth={d.tot.netWorth} monthNet={monthNet} />
      </Appear>

      {/* Livre para gastar */}
      <Appear delay={120}>
        <Panel c={12} pad={14} stroke={alpha(C.income, 0.35)} style={{ marginBottom: 14 }}>
          <Row gap={12}>
            <View style={{ flex: 1, gap: 3 }}>
              <T v="label" color={C.income}>Livre para gastar</T>
              <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.mute }}>
                {d.reserved > 0 ? `contas − ${fmt(d.reserved, { compact: true })} reservado em missões` : 'saldo das contas, sem vales e investimentos'}
              </Text>
            </View>
            <AnimatedNumber value={free} style={{ fontFamily: F.monoBold, fontSize: 20, color: free >= 0 ? C.income : C.expense, maxWidth: 170 }} />
          </Row>
        </Panel>
      </Appear>

      {/* Balanço */}
      <Appear delay={160}>
        <Panel accent={C.gold} style={{ gap: 14 }}>
          <Row>
            <T v="label" color={C.sub} style={{ flex: 1 }}>{scope === 'month' ? `Balanço · ${monthName(ym)}` : 'Balanço · desde o início'}</T>
            <Chip small label="MÊS" active={scope === 'month'} onPress={() => setScope('month')} />
            <Chip small label="TOTAL" active={scope === 'total'} onPress={() => setScope('total')} />
          </Row>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label="Recebi" color={C.income} value={scope === 'month' ? d.month.incDone : d.tot.received} sub={scope === 'month' && d.month.incPlan ? `+${fmt(d.month.incPlan, { compact: true })} prev.` : undefined} />
            <Stat label="Gastei" color={C.expense} value={scope === 'month' ? d.month.expDone : d.tot.spent} sub={scope === 'month' && d.month.expPlan ? `+${fmt(d.month.expPlan, { compact: true })} prev.` : undefined} />
            <Stat label="Investi" color={C.invest} value={scope === 'month' ? d.month.invested : d.tot.invested} />
          </View>
          {scope === 'month' ? (
            <View style={styles.projection}>
              <T v="label" color={C.mute} style={{ flex: 1 }}>Projeção fim do mês</T>
              <AnimatedNumber value={d.proj} style={{ fontFamily: F.monoBold, fontSize: 16, color: d.proj >= 0 ? C.text : C.expense }} />
            </View>
          ) : (
            <View style={styles.projection}>
              <T v="label" color={C.mute} style={{ flex: 1 }}>Saldo de vida (recebi − gastei)</T>
              <AnimatedNumber value={d.tot.received - d.tot.spent} style={{ fontFamily: F.monoBold, fontSize: 16, color: d.tot.received - d.tot.spent >= 0 ? C.income : C.expense }} />
            </View>
          )}
        </Panel>
      </Appear>

      {/* Vales (fora do patrimônio) */}
      {d.benefits.length ? (
        <Appear delay={200}>
          <SectionTitle title="Vales · fora do total" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {d.benefits.map((b) => (
              <Press key={b.id} style={{ flex: 1 }} onPress={() => nav.open({ t: 'add', mode: 'expense', accountId: b.id })} onLongPress={() => nav.open({ t: 'account', id: b.id })}>
                <View style={[styles.vale, { borderColor: alpha(b.color, 0.35) }]}>
                  <Row gap={6}>
                    <View style={{ width: 7, height: 7, backgroundColor: b.color, transform: [{ rotate: '45deg' }] }} />
                    <Text style={{ fontFamily: F.monoBold, fontSize: 13, color: b.color, letterSpacing: 1 }}>{initials(b.name)}</Text>
                  </Row>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.monoBold, fontSize: 15, color: b.balance >= 0 ? C.text : C.expense, marginTop: 6 }}>
                    {fmt(b.balance, { compact: true })}
                  </Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.mute, marginTop: 2 }}>toque: gastar</Text>
                </View>
              </Press>
            ))}
          </View>
        </Appear>
      ) : null}

      {d.count === 0 ? (
        <Appear delay={220}>
          <Panel style={{ marginTop: 14, gap: 12 }} stroke={alpha(C.gold, 0.4)}>
            <T v="h3">Comece sua jornada</T>
            <T v="small" color={C.sub}>Registre seu primeiro lançamento para ganhar XP. Salário, aluguel e assinaturas podem repetir sozinhos todo mês.</T>
            <Row>
              <Btn label="Receita" icon="up" color={C.income} variant="ghost" small onPress={() => nav.open({ t: 'add', mode: 'income' })} />
              <Btn label="Despesa" icon="down" color={C.expense} variant="ghost" small onPress={() => nav.open({ t: 'add', mode: 'expense' })} />
              <Btn label="Aporte" icon="vault" color={C.invest} variant="ghost" small onPress={() => nav.open({ t: 'add', mode: 'invest' })} />
            </Row>
          </Panel>
        </Appear>
      ) : null}

      {/* Pendências */}
      {d.pend.length ? (
        <Appear delay={240}>
          <SectionTitle title={`Pendências · ${d.pend.length}`} color={C.warn} />
          <View style={{ gap: 6 }}>
            {d.pend.slice(0, 6).map((t) => (
              <TxRow key={t.id} tx={t} showDate onPress={() => nav.open({ t: 'tx', id: t.id })} onConfirm={() => confirmEntry(t.id)} />
            ))}
            {d.pend.length > 6 ? <T v="small" color={C.mute}>+{d.pend.length - 6} no Extrato</T> : null}
          </View>
        </Appear>
      ) : null}

      {/* Próximos dias */}
      {d.next.length ? (
        <Appear delay={280}>
          <SectionTitle title="Próximos 7 dias" />
          <View style={{ gap: 6 }}>
            {d.next.slice(0, 5).map((t) => (
              <TxRow key={t.id} tx={t} showDate onPress={() => nav.open({ t: 'tx', id: t.id })} />
            ))}
          </View>
        </Appear>
      ) : null}

      {/* Missão ativa */}
      {d.goal ? (
        <Appear delay={320}>
          <SectionTitle title="Missão ativa" right={<Text onPress={() => nav.setTab('quests')} style={styles.link}>VER TODAS</Text>} />
          <Panel onPress={() => nav.open({ t: 'goal', id: d.goal!.id })} accent={d.goal.color}>
            <Row gap={14}>
              <Ring size={62} stroke={6} progress={d.goal.progress_cents / d.goal.target_cents} color={d.goal.color}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 13, color: d.goal.color }}>{Math.floor((d.goal.progress_cents / d.goal.target_cents) * 100)}%</Text>
              </Ring>
              <View style={{ flex: 1, gap: 3 }}>
                <T v="h3" numberOfLines={1}>{d.goal.name}</T>
                <T v="mono" color={C.sub} style={{ fontSize: 12.5 }}>{fmt(d.goal.progress_cents)} / {fmt(d.goal.target_cents)}</T>
              </View>
              <Icon name="chevR" size={18} color={C.mute} />
            </Row>
          </Panel>
        </Appear>
      ) : null}

      {/* Orçamentos */}
      <Appear delay={360}>
        <SectionTitle title="Orçamentos · HP do mês" />
        {d.budgets.length ? (
          <View style={{ gap: 8 }}>
            {d.budgets.map((b) => {
              const hp = Math.max(0, 1 - b.spent / b.budget);
              const ghost = Math.min(hp, b.planned / b.budget);
              const left = b.budget - b.spent;
              return (
                <Panel key={b.id} pad={12} c={10} onPress={() => nav.open({ t: 'category', id: b.id })}>
                  <Row gap={12}>
                    <CodeTile code={b.code} color={b.color} size={34} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Row>
                        <T v="body" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{b.name}</T>
                        <Text style={{ fontFamily: F.monoBold, fontSize: 12, color: left >= 0 ? C.sub : C.expense }}>
                          {left >= 0 ? `${fmt(left, { compact: true })} livre` : `${fmt(-left, { compact: true })} estourado`}
                        </Text>
                      </Row>
                      <HPBar hp={hp} ghost={ghost} />
                    </View>
                  </Row>
                </Panel>
              );
            })}
          </View>
        ) : (
          <Panel onPress={() => nav.open({ t: 'settings' })} pad={14}>
            <Row>
              <Icon name="tag" size={20} color={C.mute} />
              <T v="small" color={C.sub} style={{ flex: 1 }}>Defina um limite mensal para suas categorias. Cada gasto tira HP da barra.</T>
              <Icon name="chevR" size={16} color={C.mute} />
            </Row>
          </Panel>
        )}
      </Appear>
    </ScrollView>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <View style={[styles.stat, { borderColor: alpha(color, 0.28) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 6, height: 6, backgroundColor: color }} />
        <T v="label" color={C.sub} style={{ fontSize: 9.5 }}>{label}</T>
      </View>
      <AnimatedNumber value={value} format={(v) => fmt(v, { compact: true })} style={{ fontFamily: F.monoBold, fontSize: 15, color, marginTop: 6 }} />
      {sub ? <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.mute, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

const ACircle = Animated.createAnimatedComponent(Circle);
const AG = Animated.createAnimatedComponent(View);

function VaultCore({ inAccounts, inAssets, netWorth, monthNet }: { inAccounts: number; inAssets: number; netWorth: number; monthNet: number }) {
  const S = 248;
  const cx = S / 2;
  const r = 96;
  const circ = 2 * Math.PI * r;
  const a = Math.max(0, inAccounts);
  const b = Math.max(0, inAssets);
  const sum = a + b;
  const fa = sum > 0 ? a / sum : 0;
  const gap = sum > 0 && a > 0 && b > 0 ? 6 : 0;
  const lenA = Math.max(0, fa * circ - gap);
  const lenB = Math.max(0, (1 - fa) * circ - gap);

  const spin = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [spin]);
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow, fa, sum]);

  const label = fmt(netWorth);
  const fontSize = Math.min(30, 172 / (label.length * 0.6));

  return (
    <View style={{ alignItems: 'center', marginVertical: 18 }}>
      <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
        <AG style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <Svg width={S} height={S}>
            {Array.from({ length: 72 }, (_, i) => {
              const ang = (i / 72) * Math.PI * 2;
              const long = i % 6 === 0;
              const r1 = S / 2 - 2;
              const r2 = r1 - (long ? 9 : 4);
              return (
                <Line key={i} x1={cx + Math.cos(ang) * r1} y1={cx + Math.sin(ang) * r1} x2={cx + Math.cos(ang) * r2} y2={cx + Math.sin(ang) * r2} stroke={long ? alpha(C.gold, 0.55) : C.lineHi} strokeWidth={long ? 2 : 1} />
              );
            })}
          </Svg>
        </AG>
        <Svg width={S} height={S} style={StyleSheet.absoluteFill}>
          <Circle cx={cx} cy={cx} r={r + 14} stroke={C.line} strokeWidth={1} fill="none" />
          <Circle cx={cx} cy={cx} r={r - 14} stroke={C.line} strokeWidth={1} fill={alpha(C.bg2, 0.9)} />
          <Circle cx={cx} cy={cx} r={r} stroke={C.panelHi} strokeWidth={12} fill="none" />
          <G rotation={-90} origin={`${cx}, ${cx}`}>
            {lenA > 0 ? (
              <ACircle cx={cx} cy={cx} r={r} stroke={C.gold} strokeWidth={12} fill="none" strokeDasharray={`${lenA} ${circ}`} strokeDashoffset={grow.interpolate({ inputRange: [0, 1], outputRange: [lenA, 0] })} />
            ) : null}
          </G>
          <G rotation={-90 + fa * 360} origin={`${cx}, ${cx}`}>
            {lenB > 0 ? (
              <ACircle cx={cx} cy={cx} r={r} stroke={C.invest} strokeWidth={12} fill="none" strokeDasharray={`${lenB} ${circ}`} strokeDashoffset={grow.interpolate({ inputRange: [0, 1], outputRange: [lenB, 0] })} />
            ) : null}
          </G>
        </Svg>
        <View style={{ alignItems: 'center', width: 176 }}>
          <T v="label" color={C.mute}>Patrimônio</T>
          <AnimatedNumber value={netWorth} duration={1100} style={{ fontFamily: F.monoBold, fontSize, color: netWorth >= 0 ? C.text : C.expense, marginVertical: 4, letterSpacing: -0.8 }} />
          <Text style={{ fontFamily: F.monoBold, fontSize: 11.5, color: monthNet >= 0 ? C.income : C.expense }}>
            {monthNet >= 0 ? '▲' : '▼'} {fmt(Math.abs(monthNet), { compact: true })} no mês
          </Text>
        </View>
      </View>
      <Row gap={22} style={{ marginTop: 8 }}>
        <Legend color={C.gold} label="Em contas" value={inAccounts} />
        <Legend color={C.invest} label="Investido" value={inAssets} />
      </Row>
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Row gap={8}>
      <View style={{ width: 9, height: 9, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View>
        <T v="label" color={C.mute} style={{ fontSize: 9 }}>{label}</T>
        <Text style={{ fontFamily: F.monoBold, fontSize: 13, color: value < 0 ? C.expense : C.text }}>{fmt(value, { compact: true })}</Text>
      </View>
    </Row>
  );
}

/** "Vale Refeição" → "VR"; nomes curtos ficam como estão. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^(de|da|do|das|dos|e)$/i.test(w));
  if (name.length <= 4 || words.length < 2) return name.slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

const styles = StyleSheet.create({
  vale: { borderWidth: 1, backgroundColor: C.panel, padding: 10 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.panel },
  stat: { flex: 1, borderWidth: 1, padding: 10, backgroundColor: C.bg2 },
  projection: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  link: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 1.2, color: C.gold },
});
