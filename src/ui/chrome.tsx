// Elementos fixos da interface: fundo, dock de navegação, teclado numérico e camada de efeitos.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C, F, alpha } from '../theme';
import { Icon, IconName } from './Icon';
import { ChamferBg } from './kit';
import { Tab, useNav } from '../nav';
import { fx, FxEvent } from '../game/fx';
import { buzz } from '../game/actions';

const { width: SW, height: SH } = Dimensions.get('window');

// ───────────────────────── Fundo ─────────────────────────
export function GridBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SW} height={SH}>
        <Defs>
          <Pattern id="grid" width={28} height={28} patternUnits="userSpaceOnUse">
            <Path d="M28 0 H0 V28" fill="none" stroke="#FFFFFF" strokeOpacity={0.035} strokeWidth={1} />
          </Pattern>
          <RadialGradient id="glow" cx="50%" cy="8%" r="75%">
            <Stop offset="0" stopColor={C.gold} stopOpacity={0.09} />
            <Stop offset="0.5" stopColor={C.gold} stopOpacity={0.015} />
            <Stop offset="1" stopColor={C.bg} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.6" stopColor={C.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={C.bg} stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect width={SW} height={SH} fill={C.bg} />
        <Rect width={SW} height={SH} fill="url(#grid)" />
        <Rect width={SW} height={SH} fill="url(#glow)" />
        <Rect width={SW} height={SH} fill="url(#fadeBottom)" />
      </Svg>
    </View>
  );
}

// ───────────────────────── Dock ─────────────────────────
const TABS: ({ id: Tab; icon: IconName; label: string } | null)[] = [
  { id: 'home', icon: 'home', label: 'Base' },
  { id: 'ledger', icon: 'list', label: 'Extrato' },
  null,
  { id: 'vault', icon: 'vault', label: 'Cofre' },
  { id: 'quests', icon: 'target', label: 'Missões' },
];
export const DOCK_SPACE = 104;

export function Dock() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((t) => t?.id === nav.tab);
  const x = useRef(new Animated.Value(idx)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [idx, x]);

  const slot = w / 5;
  const onAdd = () => {
    buzz('light');
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    nav.open({ t: 'add' });
  };

  return (
    <View style={[styles.dock, { bottom: insets.bottom + 10 }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ChamferBg w={w} h={64} c={16} fill="rgba(16,19,26,0.97)" stroke={C.lineHi} />
      {w > 0 ? (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0, width: slot, alignItems: 'center',
            transform: [{ translateX: x.interpolate({ inputRange: [0, 4], outputRange: [0, slot * 4] }) }],
          }}
        >
          <View style={{ width: 28, height: 3, backgroundColor: C.gold }} />
        </Animated.View>
      ) : null}
      {TABS.map((t, i) =>
        t ? (
          <Pressable key={t.id} style={styles.tab} onPress={() => { buzz('light'); nav.setTab(t.id); }}>
            <Icon name={t.icon} size={22} color={nav.tab === t.id ? C.gold : C.mute} />
            <Text style={[styles.tabLabel, { color: nav.tab === t.id ? C.gold : C.mute }]}>{t.label}</Text>
          </Pressable>
        ) : (
          <View key={i} style={styles.tab}>
            <Pressable onPress={onAdd} style={styles.addWrap} hitSlop={8}>
              <Animated.View
                style={[
                  styles.add,
                  { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '135deg'] }) }] },
                ]}
              >
                <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="addg" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#FFE08A" />
                      <Stop offset="1" stopColor={C.goldDeep} />
                    </LinearGradient>
                  </Defs>
                  <Rect x={1} y={1} width={54} height={54} fill="url(#addg)" stroke={C.bg} strokeWidth={2} />
                </Svg>
                <View style={{ transform: [{ rotate: '-45deg' }] }}>
                  <Icon name="plus" size={26} color={C.bg} stroke={3} />
                </View>
              </Animated.View>
            </Pressable>
          </View>
        ),
      )}
    </View>
  );
}

// ───────────────────────── Teclado numérico ─────────────────────────
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'del' | 'clr';

export function Keypad({ onKey, onSubmit, color = C.gold, submitLabel = 'SALVAR' }: { onKey: (k: KeypadKey) => void; onSubmit: () => void; color?: string; submitLabel?: string }) {
  const rows: KeypadKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['00', '0', 'clr']];
  return (
    <View style={styles.keypad}>
      <View style={{ flex: 3, gap: 6 }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
            {r.map((k) => (
              <Key key={k} onPress={() => onKey(k)} label={k === 'clr' ? 'C' : k} dim={k === 'clr'} />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Key onPress={() => onKey('del')} label="⌫" dim />
        <Pressable
          onPress={() => { buzz(); onSubmit(); }}
          style={({ pressed }) => [styles.submit, { backgroundColor: pressed ? alpha(color, 0.75) : color }]}
        >
          <Icon name="check" size={26} color={C.bg} stroke={3} />
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Key({ label, onPress, dim }: { label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable
      onPress={() => { buzz('light'); onPress(); }}
      style={({ pressed }) => [styles.key, pressed && { backgroundColor: C.lineHi, transform: [{ scale: 0.95 }] }]}
    >
      <Text style={[styles.keyText, dim && { color: C.sub, fontSize: 18 }]}>{label}</Text>
    </Pressable>
  );
}

// ───────────────────────── Efeitos (XP, conquistas, level up) ─────────────────────────
interface FloatItem { id: number; text: string; sub?: string; color: string }
let fxSeq = 0;

export function FxLayer() {
  const insets = useSafeAreaInsets();
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [ach, setAch] = useState<{ id: number; title: string; desc: string } | null>(null);
  const [lvl, setLvl] = useState<{ id: number; level: number; rank: string } | null>(null);

  useEffect(
    () =>
      fx.on((e: FxEvent) => {
        if (e.type === 'xp') setFloats((f) => [...f.slice(-2), { id: ++fxSeq, text: `+${e.amount} XP`, sub: e.label, color: C.gold }]);
        else if (e.type === 'toast') setFloats((f) => [...f.slice(-2), { id: ++fxSeq, text: e.text, color: e.color ?? C.text }]);
        else if (e.type === 'achievement') setAch({ id: ++fxSeq, title: e.title, desc: e.desc });
        else if (e.type === 'level') {
          buzz();
          setLvl({ id: ++fxSeq, level: e.level, rank: e.rank });
        }
      }),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', gap: 6 }} pointerEvents="none">
        {floats.map((f) => (
          <FloatToast key={f.id} item={f} onDone={() => setFloats((all) => all.filter((x) => x.id !== f.id))} />
        ))}
      </View>
      {ach ? <AchievementBanner key={ach.id} title={ach.title} desc={ach.desc} top={insets.top} onDone={() => setAch(null)} /> : null}
      {lvl ? <LevelUp key={lvl.id} level={lvl.level} rank={lvl.rank} onDone={() => setLvl(null)} /> : null}
    </View>
  );
}

function FloatToast({ item, onDone }: { item: FloatItem; onDone: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }),
      Animated.delay(1300),
      Animated.timing(a, { toValue: 2, duration: 380, useNativeDriver: true }),
    ]).start(onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={{
        opacity: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1, 2], outputRange: [-14, 0, -18] }) },
          { scale: a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.8, 1, 0.96] }) },
        ],
      }}
    >
      <View style={[styles.float, { borderColor: alpha(item.color, 0.6) }]}>
        <Icon name="bolt" size={15} color={item.color} />
        <Text style={{ fontFamily: F.monoBold, color: item.color, fontSize: 14 }}>{item.text}</Text>
        {item.sub ? <Text style={{ fontFamily: F.med, color: C.sub, fontSize: 12 }}>{item.sub}</Text> : null}
      </View>
    </Animated.View>
  );
}

function AchievementBanner({ title, desc, top, onDone }: { title: string; desc: string; top: number; onDone: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 9 }),
      Animated.delay(2800),
      Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.ach, { top: top + 52, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }]}
    >
      <ChamferBg w={w} h={68} c={14} fill="#1A1608" stroke={C.gold} accent={C.gold} />
      <Icon name="trophy" size={28} color={C.gold} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.8, color: C.gold }}>CONQUISTA DESBLOQUEADA</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{title}</Text>
        <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.sub }} numberOfLines={1}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const ang = (i / 22) * Math.PI * 2 + (i % 2) * 0.15;
  const dist = 110 + (i % 4) * 34;
  return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, size: 5 + (i % 3) * 3, color: i % 3 === 0 ? C.income : i % 3 === 1 ? C.gold : C.invest };
});

function LevelUp({ level, rank, onDone }: { level: number; rank: string; onDone: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const finish = () =>
    Animated.timing(out, { toValue: 0, duration: 300, useNativeDriver: true }).start(onDone);
  useEffect(() => {
    Animated.parallel([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12 }),
      Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(finish, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out }]}>
      <Pressable style={[StyleSheet.absoluteFill, styles.lvlBg]} onPress={finish}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {PARTICLES.map((p, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute', width: p.size, height: p.size, backgroundColor: p.color,
                opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                  { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${180 + i * 20}deg`] }) },
                ],
              }}
            />
          ))}
          <Animated.View style={{ alignItems: 'center', transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: a }}>
            <Text style={{ fontFamily: F.monoBold, color: C.gold, letterSpacing: 6, fontSize: 13 }}>LEVEL UP</Text>
            <View style={styles.lvlHex}>
              <Text style={{ fontFamily: F.monoBold, color: C.bg, fontSize: 54, transform: [{ rotate: '-45deg' }] }}>{level}</Text>
            </View>
            <Text style={{ fontFamily: F.bold, color: C.text, fontSize: 26, marginTop: 8 }}>Nível {level}</Text>
            <Text style={{ fontFamily: F.med, color: C.sub, fontSize: 15, marginTop: 2 }}>Patente: {rank}</Text>
            <Text style={{ fontFamily: F.reg, color: C.mute, fontSize: 12, marginTop: 24 }}>toque para continuar</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 12, right: 12, height: 64, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontFamily: F.monoBold, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },
  addWrap: { marginTop: -34 },
  add: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.6, shadowRadius: 16, elevation: 10 },
  keypad: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  key: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  keyText: { fontFamily: F.monoBold, fontSize: 22, color: C.text },
  submit: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  submitText: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.5, color: C.bg },
  float: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(12,14,19,0.96)', borderWidth: 1 },
  ach: { position: 'absolute', left: 16, right: 16, height: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  lvlBg: { backgroundColor: 'rgba(5,6,8,0.92)', alignItems: 'center', justifyContent: 'center' },
  lvlHex: { width: 110, height: 110, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }], marginTop: 22, marginBottom: 18, shadowColor: C.gold, shadowOpacity: 0.9, shadowRadius: 30, elevation: 16 },
});
