import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';

import { C } from './src/theme';
import { getMeta, initDb } from './src/db/db';
import { extendRecurrences } from './src/db/repo';
import { useQuery } from './src/db/store';
import { NavProvider, Sheet, SheetStateProvider, useNav } from './src/nav';
import { Dock, FxLayer, GridBackground } from './src/ui/chrome';
import { Appear } from './src/ui/kit';
import { HomeScreen } from './src/screens/Home';
import { LedgerScreen } from './src/screens/Ledger';
import { VaultScreen } from './src/screens/Vault';
import { QuestsScreen } from './src/screens/Quests';
import { Onboarding } from './src/screens/Onboarding';
import { AddEntrySheet, TxSheet } from './src/sheets/Entry';
import { AccountSheet, AssetEditSheet, AssetSheet, CategorySheet, GoalEditSheet, GoalSheet, SettingsSheet } from './src/sheets/Other';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  const [boot, setBoot] = useState<{ ok: boolean; err?: string } | null>(null);

  useEffect(() => {
    try {
      initDb();
      extendRecurrences();
      setBoot({ ok: true });
    } catch (e) {
      setBoot({ ok: false, err: String((e as Error)?.message ?? e) });
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded && boot) SplashScreen.hide();
  }, [fontsLoaded, boot]);

  if (!fontsLoaded || !boot) return null;

  if (!boot.ok) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: C.expense, fontSize: 18, marginBottom: 8 }}>Falha ao abrir o banco de dados</Text>
        <Text style={{ color: C.sub }}>{boot.err}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <GridBackground />
        <NavProvider>
          <Main />
        </NavProvider>
      </View>
    </SafeAreaProvider>
  );
}

function Main() {
  const nav = useNav();
  const name = useQuery(() => getMeta('player_name'));

  if (!name) {
    return (
      <>
        <Onboarding />
        <FxLayer />
      </>
    );
  }

  return (
    <>
      <Appear key={nav.tab} from={10} style={{ flex: 1 }}>
        {nav.tab === 'home' ? <HomeScreen /> : nav.tab === 'ledger' ? <LedgerScreen /> : nav.tab === 'vault' ? <VaultScreen /> : <QuestsScreen />}
      </Appear>
      <Dock />
      {nav.stack.map((e) => (
        <SheetStateProvider key={e.key} value={{ closing: e.closing, onGone: () => nav.remove(e.key) }}>
          <SheetView sheet={e.sheet} />
        </SheetStateProvider>
      ))}
      <FxLayer />
    </>
  );
}

function SheetView({ sheet: s }: { sheet: Sheet }) {
  switch (s.t) {
    case 'add':
      return <AddEntrySheet mode={s.mode} editId={s.editId} assetId={s.assetId} moveKind={s.moveKind} accountId={s.accountId} />;
    case 'tx':
      return <TxSheet id={s.id} />;
    case 'asset':
      return <AssetSheet id={s.id} />;
    case 'assetEdit':
      return <AssetEditSheet id={s.id} />;
    case 'goal':
      return <GoalSheet id={s.id} />;
    case 'goalEdit':
      return <GoalEditSheet id={s.id} />;
    case 'settings':
      return <SettingsSheet />;
    case 'category':
      return <CategorySheet id={s.id} kind={s.kind} />;
    case 'account':
      return <AccountSheet id={s.id} />;
  }
}
