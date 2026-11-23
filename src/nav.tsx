import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Easing, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C, alpha } from './theme';
import { T, IconBtn } from './ui/kit';

export type Tab = 'home' | 'ledger' | 'vault' | 'quests';

export type Sheet =
  | { t: 'add'; mode?: 'income' | 'expense' | 'invest'; editId?: number; assetId?: number; moveKind?: 'aporte' | 'resgate' }
  | { t: 'tx'; id: number }
  | { t: 'assetEdit'; id?: number }
  | { t: 'asset'; id: number }
  | { t: 'goalEdit'; id?: number }
  | { t: 'goal'; id: number }
  | { t: 'settings' }
  | { t: 'category'; id?: number; kind?: 'income' | 'expense' }
  | { t: 'account'; id?: number };

interface Entry { key: number; sheet: Sheet; closing: boolean }

interface NavCtx {
  tab: Tab;
  setTab: (t: Tab) => void;
  open: (s: Sheet) => void;
  close: () => void;
  /** fecha o sheet atual e abre outro */
  swap: (s: Sheet) => void;
  stack: Entry[];
  remove: (key: number) => void;
}

const Ctx = createContext<NavCtx | null>(null);
export const useNav = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav fora do provider');
  return c;
};

let keySeq = 0;

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Entry[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const open = useCallback((s: Sheet) => setStack((st) => [...st, { key: ++keySeq, sheet: s, closing: false }]), []);
  const close = useCallback(() => {
    setStack((st) => {
      const idx = [...st].reverse().findIndex((e) => !e.closing);
      if (idx < 0) return st;
      const real = st.length - 1 - idx;
      return st.map((e, i) => (i === real ? { ...e, closing: true } : e));
    });
  }, []);
  const swap = useCallback((s: Sheet) => {
    setStack((st) => {
      const idx = [...st].reverse().findIndex((e) => !e.closing);
      const real = idx < 0 ? -1 : st.length - 1 - idx;
      const marked = st.map((e, i) => (i === real ? { ...e, closing: true } : e));
      return [...marked, { key: ++keySeq, sheet: s, closing: false }];
    });
  }, []);
  const remove = useCallback((key: number) => setStack((st) => st.filter((e) => e.key !== key)), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.some((e) => !e.closing)) {
        close();
        return true;
      }
      if (tabRef.current !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [close]);

  const value = useMemo(() => ({ tab, setTab, open, close, swap, stack, remove }), [tab, open, close, swap, stack, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ───────────────────────── Sheet ─────────────────────────
const SheetState = createContext<{ closing: boolean; onGone: () => void }>({ closing: false, onGone: () => {} });
export const SheetStateProvider = SheetState.Provider;

export function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return h;
}

const SCREEN_H = Dimensions.get('window').height;

export function SheetFrame({ title, accent = C.gold, children, footer, full, scroll = true }: { title: string; accent?: string; children: React.ReactNode; footer?: React.ReactNode; full?: boolean; scroll?: boolean }) {
  const { closing, onGone } = useContext(SheetState);
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const y = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [y, fade]);

  const goneRef = useRef(onGone);
  goneRef.current = onGone;
  useEffect(() => {
    if (!closing) return;
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(y, { toValue: SCREEN_H, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => goneRef.current());
  }, [closing, y, fade]);

  const c = 18;
  const maxH = SCREEN_H - insets.top - 12;
  const body = (
    <View style={{ padding: 18, paddingTop: 4 }}>{children}</View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'box-none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,4,6,0.78)', opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={nav.close} />
      </Animated.View>
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[
          styles.sheet,
          { maxHeight: maxH, paddingBottom: (kb > 0 ? kb : insets.bottom) + 6, transform: [{ translateY: y }] },
          full && { height: maxH },
        ]}
      >
        {w > 0 ? (
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
            <Svg width={w} height={SCREEN_H * 1.1}>
              <Path d={`M0 ${c} L${c} 0 H${w - c} L${w} ${c} V${SCREEN_H * 1.1} H0 Z`} fill={C.bg2} stroke={alpha(accent, 0.55)} strokeWidth={1.2} />
              <Path d={`M${w / 2 - 22} 9 H${w / 2 + 22}`} stroke={C.lineHi} strokeWidth={4} />
            </Svg>
          </View>
        ) : null}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={{ width: 8, height: 8, backgroundColor: accent, transform: [{ rotate: '45deg' }] }} />
            <T v="label" color={accent}>{title}</T>
          </View>
          <IconBtn icon="close" onPress={nav.close} size={36} bg={C.panel} />
        </View>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={full ? { flex: 1 } : undefined}>
            {body}
          </ScrollView>
        ) : (
          <View style={full ? { flex: 1 } : undefined}>{body}</View>
        )}
        {footer}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10 },
});
