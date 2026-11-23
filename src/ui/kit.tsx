import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import { Icon, IconName } from './Icon';
import { buzz } from '../game/actions';

// ───────────────────────── Texto ─────────────────────────
type TV = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'mono' | 'monoBig' | 'monoHuge';
const TSTYLE: Record<TV, TextStyle> = {
  h1: { fontFamily: F.bold, fontSize: 28, letterSpacing: -0.5 },
  h2: { fontFamily: F.bold, fontSize: 20, letterSpacing: -0.2 },
  h3: { fontFamily: F.bold, fontSize: 16 },
  body: { fontFamily: F.med, fontSize: 15 },
  small: { fontFamily: F.reg, fontSize: 13 },
  label: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  mono: { fontFamily: F.mono, fontSize: 14 },
  monoBig: { fontFamily: F.monoBold, fontSize: 22, letterSpacing: -0.5 },
  monoHuge: { fontFamily: F.monoBold, fontSize: 34, letterSpacing: -1.2 },
};
export function T({ v = 'body', color = C.text, style, children, numberOfLines }: { v?: TV; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[TSTYLE[v], { color }, style]}>
      {children}
    </Text>
  );
}

// ───────────────────────── Formas chanfradas ─────────────────────────
function useSize() {
  const [s, set] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - s.w) > 0.5 || Math.abs(height - s.h) > 0.5) set({ w: width, h: height });
  };
  return [s, onLayout] as const;
}

const chamferPath = (w: number, h: number, c: number, o = 0.5) =>
  `M${c} ${o} H${w - o} V${h - c} L${w - c} ${h - o} H${o} V${c} Z`;

export function ChamferBg({ w, h, c = 12, fill = C.panel, stroke = C.line, strokeWidth = 1, accent }: { w: number; h: number; c?: number; fill?: string; stroke?: string; strokeWidth?: number; accent?: string }) {
  if (w <= 0 || h <= 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={w} height={h}>
        <Path d={chamferPath(w, h, c)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {accent ? (
          <>
            <Path d={`M1 ${c + 14} V${c} L${c} 1 H${c + 30}`} stroke={accent} strokeWidth={2} fill="none" />
            <Path d={`M${w - 1} ${h - c - 12} V${h - c} L${w - c} ${h - 1} H${w - c - 22}`} stroke={accent} strokeWidth={2} fill="none" opacity={0.55} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

export function Panel({ children, style, accent, c = 14, fill = C.panel, stroke = C.line, pad = 16, onPress }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string; c?: number; fill?: string; stroke?: string; pad?: number; onPress?: () => void }) {
  const [s, onLayout] = useSize();
  const body = (
    <View onLayout={onLayout} style={[{ padding: pad }, style]}>
      <ChamferBg w={s.w} h={s.h} c={c} fill={fill} stroke={stroke} accent={accent} />
      {children}
    </View>
  );
  if (!onPress) return body;
  return <Press onPress={onPress}>{body}</Press>;
}

// ───────────────────────── Interação ─────────────────────────
export function Press({ onPress, onLongPress, children, style, disabled, scaleTo = 0.97, haptic = true }: { onPress?: () => void; onLongPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; scaleTo?: number; haptic?: boolean }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic) buzz('light');
        onPress?.();
      }}
      onLongPress={onLongPress}
      hitSlop={4}
    >
      <Animated.View style={[style, { transform: [{ scale: s }], opacity: disabled ? 0.4 : 1 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Btn({ label, onPress, color = C.gold, variant = 'solid', icon, small, disabled, style }: { label: string; onPress: () => void; color?: string; variant?: 'solid' | 'ghost' | 'outline'; icon?: IconName; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const [s, onLayout] = useSize();
  const fg = variant === 'solid' ? C.bg : color;
  const fill = variant === 'solid' ? color : variant === 'ghost' ? alpha(color, 0.12) : 'transparent';
  const stroke = variant === 'outline' ? alpha(color, 0.7) : variant === 'ghost' ? alpha(color, 0.25) : color;
  return (
    <Press onPress={onPress} disabled={disabled} style={style}>
      <View onLayout={onLayout} style={[styles.btn, small && styles.btnSmall]}>
        <ChamferBg w={s.w} h={s.h} c={small ? 7 : 10} fill={fill} stroke={stroke} />
        {icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} /> : null}
        <Text style={[styles.btnText, small && { fontSize: 12 }, { color: fg }]}>{label}</Text>
      </View>
    </Press>
  );
}

export function IconBtn({ icon, onPress, color = C.sub, size = 40, bg = C.panel }: { icon: IconName; onPress: () => void; color?: string; size?: number; bg?: string }) {
  const c = size * 0.25;
  return (
    <Press onPress={onPress}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <ChamferBg w={size} h={size} c={c} fill={bg} stroke={C.line} />
        <Icon name={icon} size={size * 0.48} color={color} />
      </View>
    </Press>
  );
}

export function Chip({ label, active, color = C.gold, onPress, leading, small }: { label: string; active?: boolean; color?: string; onPress?: () => void; leading?: React.ReactNode; small?: boolean }) {
  const [s, onLayout] = useSize();
  return (
    <Press onPress={onPress} scaleTo={0.94}>
      <View onLayout={onLayout} style={[styles.chip, small && { paddingVertical: 6, paddingHorizontal: 10 }]}>
        <ChamferBg w={s.w} h={s.h} c={7} fill={active ? alpha(color, 0.16) : C.panel} stroke={active ? color : C.line} />
        {leading}
        <Text style={[styles.chipText, { color: active ? color : C.sub }, small && { fontSize: 12 }]}>{label}</Text>
      </View>
    </Press>
  );
}

export function Segmented<K extends string>({ options, value, onChange, color = C.gold }: { options: { id: K; label: string; color?: string }[]; value: K; onChange: (k: K) => void; color?: string }) {
  return (
    <View style={styles.segWrap}>
      {options.map((o) => {
        const on = o.id === value;
        const col = o.color ?? color;
        return (
          <Pressable key={o.id} onPress={() => { buzz('light'); onChange(o.id); }} style={[styles.seg, on && { backgroundColor: alpha(col, 0.16), borderColor: col }]}>
            <Text style={[styles.segText, { color: on ? col : C.mute }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────────────────── Peças de HUD ─────────────────────────
export function CodeTile({ code, color, size = 40 }: { code: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <ChamferBg w={size} h={size} c={size * 0.22} fill={alpha(color, 0.13)} stroke={alpha(color, 0.45)} />
      <Text style={{ fontFamily: F.monoBold, fontSize: size * 0.27, color, letterSpacing: 0.5 }}>{code}</Text>
    </View>
  );
}

export function SectionTitle({ title, right, color = C.mute }: { title: string; right?: React.ReactNode; color?: string }) {
  return (
    <View style={styles.section}>
      <Text style={[TSTYLE.label, { color: C.gold }]}>{'//'}</Text>
      <Text style={[TSTYLE.label, { color, marginLeft: 6 }]}>{title}</Text>
      <View style={styles.sectionLine} />
      {right}
    </View>
  );
}

export function Appear({ delay = 0, children, style, from = 14 }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function AnimatedNumber({ value, format = (v: number) => fmt(v), style, duration = 750 }: { value: number; format?: (v: number) => string; style?: StyleProp<TextStyle>; duration?: number }) {
  const [shown, setShown] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const start = cur.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      cur.current = start + (value - start) * e;
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
      {format(Math.round(shown))}
    </Text>
  );
}

export function XPBar({ progress, color = C.gold, height = 8 }: { progress: number; color?: string; height?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, progress)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, progress]);
  return (
    <View style={{ height, backgroundColor: C.line, overflow: 'hidden', transform: [{ skewX: '-18deg' }] }}>
      <Animated.View style={{ height, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: color }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height / 2.5, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </Animated.View>
    </View>
  );
}

/** Barra de vida segmentada (orçamento). hp de 0 a 1. */
export function HPBar({ hp, segments = 10, ghost = 0 }: { hp: number; segments?: number; ghost?: number }) {
  const filled = Math.max(0, Math.ceil(hp * segments - 0.001));
  const ghostFilled = Math.max(0, Math.ceil(Math.max(0, hp - ghost) * segments - 0.001));
  const col = hp > 0.5 ? C.income : hp > 0.2 ? C.warn : C.expense;
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: segments }, (_, i) => {
        const on = i < filled;
        const willLose = on && i >= ghostFilled;
        return (
          <View
            key={i}
            style={{
              flex: 1, height: 10, transform: [{ skewX: '-20deg' }],
              backgroundColor: on ? (willLose ? alpha(col, 0.35) : col) : C.line,
            }}
          />
        );
      })}
    </View>
  );
}

const ACircle = Animated.createAnimatedComponent(Circle);
export function Ring({ size = 64, stroke = 6, progress, color, track = C.line, children }: { size?: number; stroke?: number; progress: number; color: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, progress)), duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, progress]);
  const off = a.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" strokeDasharray="3 3" />
          <ACircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={off} />
        </G>
      </Svg>
      {children}
    </View>
  );
}

export function HexBadge({ level, size = 56 }: { level: number; size?: number }) {
  const s = size;
  const h = (x: number, y: number) => `${x * s} ${y * s}`;
  const d = `M${h(0.5, 0.03)} L${h(0.92, 0.27)} L${h(0.92, 0.73)} L${h(0.5, 0.97)} L${h(0.08, 0.73)} L${h(0.08, 0.27)} Z`;
  const d2 = `M${h(0.5, 0.15)} L${h(0.82, 0.33)} L${h(0.82, 0.67)} L${h(0.5, 0.85)} L${h(0.18, 0.67)} L${h(0.18, 0.33)} Z`;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="hx" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.gold} />
            <Stop offset="1" stopColor={C.goldDeep} />
          </LinearGradient>
        </Defs>
        <Path d={d} fill={alpha(C.gold, 0.1)} stroke="url(#hx)" strokeWidth={2} />
        <Path d={d2} fill="none" stroke={alpha(C.gold, 0.3)} strokeWidth={1} />
      </Svg>
      <Text style={{ fontFamily: F.monoBold, fontSize: s * 0.32, color: C.gold }}>{level}</Text>
    </View>
  );
}

export function Empty({ title, text, icon = 'bolt' }: { title: string; text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 8 }}>
      <View style={{ opacity: 0.5 }}>
        <Icon name={icon} size={30} color={C.mute} />
      </View>
      <T v="h3" color={C.sub}>{title}</T>
      <T v="small" color={C.mute} style={{ textAlign: 'center' }}>{text}</T>
    </View>
  );
}

// ───────────────────────── Formulário ─────────────────────────
export function Field({ label, value, onChange, placeholder, autoFocus, maxLength, autoCapitalize = 'sentences' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; maxLength?: number; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label" color={C.mute}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.mute}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        selectionColor={C.gold}
        style={styles.input}
      />
    </View>
  );
}

export function MoneyField({ label, value, onChange, color = C.text, allowZero = true }: { label: string; value: number; onChange: (c: number) => void; color?: string; allowZero?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label" color={C.mute}>{label}</T>
      <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
        <Text style={{ fontFamily: F.mono, color: C.mute, fontSize: 15, marginRight: 6 }}>R$</Text>
        <TextInput
          value={value || !allowZero ? fmt(value, { symbol: false }) : ''}
          onChangeText={(t) => onChange(Number(t.replace(/\D/g, '') || '0'))}
          keyboardType="number-pad"
          placeholder="0,00"
          placeholderTextColor={C.mute}
          selectionColor={C.gold}
          style={{ flex: 1, fontFamily: F.monoBold, fontSize: 17, color, paddingVertical: 12 }}
        />
      </View>
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 999, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      {label ? <T v="label" color={C.mute}>{label}</T> : null}
      <View style={styles.stepper}>
        <Pressable onPress={() => { buzz('light'); onChange(Math.max(min, value - 1)); }} onLongPress={() => onChange(Math.max(min, value - 10))} style={styles.stepBtn}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <Text style={{ fontFamily: F.monoBold, fontSize: 18, color: C.text, minWidth: 44, textAlign: 'center' }}>{value}</Text>
        <Pressable onPress={() => { buzz('light'); onChange(Math.min(max, value + 1)); }} onLongPress={() => onChange(Math.min(max, value + 10))} style={styles.stepBtn}>
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Swatches({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {colors.map((c) => (
        <Pressable key={c} onPress={() => { buzz('light'); onChange(c); }}>
          <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }], borderWidth: value === c ? 2 : 0, borderColor: C.text }}>
            <View style={{ width: 22, height: 22, backgroundColor: c }} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, gap = 10, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 18, minHeight: 50 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  btnText: { fontFamily: F.bold, fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 13 },
  chipText: { fontFamily: F.med, fontSize: 13.5 },
  segWrap: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  segText: { fontFamily: F.monoBold, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  section: { flexDirection: 'row', alignItems: 'center', marginTop: 26, marginBottom: 12 },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.line, marginHorizontal: 10 },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2, color: C.text, fontFamily: F.med, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2 },
  stepBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: F.monoBold, fontSize: 22, color: C.gold },
});
