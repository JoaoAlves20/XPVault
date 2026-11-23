import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import { monthDiff, monthShort, thisMonth } from '../lib/dates';
import { useQuery } from '../db/store';
import * as R from '../db/repo';
import { levelInfo, nextRank, streak, XP_RULES } from '../game/xp';
import { ACHIEVEMENTS, unlocked } from '../game/achievements';
import { toast } from '../game/fx';
import { useNav } from '../nav';
import { DOCK_SPACE } from '../ui/chrome';
import { Appear, Btn, Empty, HexBadge, Panel, Ring, Row, SectionTitle, T, XPBar } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function QuestsScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const d = useQuery(() => ({ lvl: levelInfo(), streak: streak(), goals: R.goals(), ach: unlocked(), counts: R.counts() }));
  const active = d.goals.filter((g) => !g.completed_at);
  const done = d.goals.filter((g) => g.completed_at);
  const nr = nextRank(d.lvl.level);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: DOCK_SPACE + insets.bottom + 10 }} showsVerticalScrollIndicator={false}>
      <T v="label" color={C.goal}>Jornada</T>
      <T v="h1">Missões</T>

      <Appear>
        <Panel accent={C.gold} style={{ marginTop: 16, gap: 14 }}>
          <Row gap={16}>
            <HexBadge level={d.lvl.level} size={78} />
            <View style={{ flex: 1, gap: 6 }}>
              <T v="label" color={C.gold}>{d.lvl.rank}</T>
              <T v="h2">Nível {d.lvl.level}</T>
              <XPBar progress={d.lvl.progress} />
              <T v="small" color={C.mute} style={{ fontFamily: F.mono, fontSize: 11 }}>
                faltam {d.lvl.ceil - d.lvl.xp} XP para o nível {d.lvl.level + 1}
              </T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Mini icon="bolt" color={C.gold} label="XP total" value={String(d.lvl.xp)} />
            <Mini icon="flame" color={C.warn} label="Sequência" value={`${d.streak}d`} />
            <Mini icon="trophy" color={C.goal} label="Conquistas" value={`${d.ach.size}/${ACHIEVEMENTS.length}`} />
          </View>
          {nr ? (
            <T v="small" color={C.sub}>
              Próxima patente: <Text style={{ color: C.gold, fontFamily: F.bold }}>{nr[1]}</Text> no nível {nr[0]}
            </T>
          ) : null}
        </Panel>
      </Appear>

      <SectionTitle title={`Missões ativas · ${active.length}`} right={<Text onPress={() => nav.open({ t: 'goalEdit' })} style={styles.link}>+ NOVA</Text>} />
      {active.length === 0 ? (
        <Panel pad={4}>
          <Empty icon="target" title="Nenhuma missão" text="Crie uma meta (reserva de emergência, viagem, carro…) e acompanhe o progresso como uma missão." />
          <View style={{ padding: 12, paddingTop: 0 }}>
            <Btn label="Criar missão" icon="plus" color={C.goal} onPress={() => nav.open({ t: 'goalEdit' })} />
          </View>
        </Panel>
      ) : (
        <View style={{ gap: 8 }}>
          {active.map((g, i) => (
            <Appear key={g.id} delay={i * 60}>
              <GoalCard g={g} onPress={() => nav.open({ t: 'goal', id: g.id })} />
            </Appear>
          ))}
        </View>
      )}

      {done.length ? (
        <>
          <SectionTitle title={`Concluídas · ${done.length}`} color={C.income} />
          <View style={{ gap: 8 }}>
            {done.map((g) => (
              <GoalCard key={g.id} g={g} onPress={() => nav.open({ t: 'goal', id: g.id })} />
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle title="Conquistas" />
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const on = d.ach.has(a.code);
          return (
            <Pressable key={a.code} style={styles.achCell} onPress={() => toast(on ? `${a.title} — ${a.desc}` : `Bloqueada: ${a.desc}`, on ? C.gold : C.sub)}>
              <AchHex glyph={on ? a.glyph : '?'} on={on} />
              <Text style={[styles.achTitle, { color: on ? C.text : C.mute }]} numberOfLines={2}>{a.title}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="Como ganhar XP" />
      <Panel pad={14} style={{ gap: 10 }}>
        {XP_RULES.map(([label, xp]) => (
          <Row key={label}>
            <Icon name="bolt" size={14} color={C.gold} />
            <T v="small" color={C.sub} style={{ flex: 1 }}>{label}</T>
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, color: C.gold }}>{xp}</Text>
          </Row>
        ))}
      </Panel>
    </ScrollView>
  );
}

export function GoalCard({ g, onPress }: { g: R.Goal; onPress: () => void }) {
  const p = g.target_cents > 0 ? g.progress_cents / g.target_cents : 0;
  const left = Math.max(0, g.target_cents - g.progress_cents);
  const months = g.deadline ? monthDiff(thisMonth(), g.deadline) + 1 : null;
  const perMonth = months && months > 0 ? Math.ceil(left / months) : null;
  const done = !!g.completed_at;
  return (
    <Panel onPress={onPress} accent={done ? C.income : g.color} pad={14}>
      <Row gap={14}>
        <Ring size={66} stroke={6} progress={p} color={done ? C.income : g.color}>
          {done ? <Icon name="check" size={24} color={C.income} stroke={3} /> : <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: g.color }}>{Math.floor(p * 100)}%</Text>}
        </Ring>
        <View style={{ flex: 1, gap: 3 }}>
          <T v="h3" numberOfLines={1}>{g.name}</T>
          <Text style={{ fontFamily: F.mono, fontSize: 12.5, color: C.sub }}>{fmt(g.progress_cents)} / {fmt(g.target_cents)}</Text>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {g.asset_name ? (
              <View style={styles.tag}>
                <Icon name="link" size={10} color={C.invest} />
                <Text style={[styles.tagText, { color: C.invest }]}>{g.asset_name}</Text>
              </View>
            ) : null}
            {!done && g.deadline ? (
              <Text style={styles.tagText}>
                {months != null && months > 0 ? `${monthShort(g.deadline)} · ${perMonth ? fmt(perMonth, { compact: true }) + '/mês' : ''}` : `prazo ${monthShort(g.deadline)} vencido`}
              </Text>
            ) : null}
          </Row>
        </View>
      </Row>
    </Panel>
  );
}

function AchHex({ glyph, on }: { glyph: string; on: boolean }) {
  const s = 64;
  const p = (x: number, y: number) => `${x * s} ${y * s}`;
  const d = `M${p(0.5, 0.04)} L${p(0.91, 0.27)} L${p(0.91, 0.73)} L${p(0.5, 0.96)} L${p(0.09, 0.73)} L${p(0.09, 0.27)} Z`;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
        <Path d={d} fill={on ? alpha(C.gold, 0.14) : C.panel} stroke={on ? C.gold : C.line} strokeWidth={on ? 2 : 1} strokeDasharray={on ? undefined : '4 3'} />
      </Svg>
      <Text style={{ fontFamily: F.monoBold, fontSize: glyph.length > 2 ? 13 : 17, color: on ? C.gold : C.mute }}>{glyph}</Text>
    </View>
  );
}

function Mini({ icon, color, label, value }: { icon: 'bolt' | 'flame' | 'trophy'; color: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, padding: 10, gap: 4 }}>
      <Row gap={5}>
        <Icon name={icon} size={12} color={color} />
        <T v="label" color={C.mute} style={{ fontSize: 9 }}>{label}</T>
      </Row>
      <Text style={{ fontFamily: F.monoBold, fontSize: 16, color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.2, color: C.goal },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  achCell: { width: '25%', alignItems: 'center', gap: 6 },
  achTitle: { fontFamily: F.med, fontSize: 11, textAlign: 'center', paddingHorizontal: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: alpha(C.invest, 0.4), paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontFamily: F.monoBold, fontSize: 10, color: C.mute, letterSpacing: 0.5 },
});
