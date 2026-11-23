import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../theme';
import { setMeta } from '../db/db';
import * as R from '../db/repo';
import * as A from '../game/actions';
import { toast } from '../game/fx';
import { Appear, Btn, Field, HexBadge, MoneyField, Panel, Row, T } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function Onboarding() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);

  const start = () => {
    if (!name.trim()) return toast('Como devemos te chamar?', C.warn);
    A.write(() => {
      const main = R.accounts()[0];
      if (main) R.saveAccount({ id: main.id, name: main.name, color: main.color, initial_cents: balance });
      setMeta('player_name', name.trim());
    });
    toast(`Bem-vindo(a), ${name.trim()}!`, C.gold);
  };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 22 }} keyboardShouldPersistTaps="handled">
        <Appear>
          <HexBadge level={1} size={84} />
        </Appear>
        <Appear delay={100}>
          <Text style={{ fontFamily: F.monoBold, color: C.gold, letterSpacing: 4, fontSize: 12 }}>XPVAULT</Text>
          <Text style={{ fontFamily: F.bold, color: C.text, fontSize: 34, lineHeight: 38, marginTop: 6 }}>Seu dinheiro.{'\n'}Sua campanha.</Text>
          <T v="body" color={C.sub} style={{ marginTop: 10 }}>
            Registre o que entra e sai, invista, cumpra missões e suba de nível. Tudo fica só no seu celular, mesmo sem internet.
          </T>
        </Appear>
        <Appear delay={200}>
          <Panel accent={C.gold} style={{ gap: 16 }}>
            <Field label="Nome do jogador" value={name} onChange={setName} placeholder="Como quer ser chamado?" autoCapitalize="words" />
            <View style={{ gap: 6 }}>
              <MoneyField label="Quanto tem na conta hoje?" value={balance} onChange={setBalance} color={C.gold} />
              <T v="small" color={C.mute}>Saldo inicial da sua conta principal. Dá para ajustar depois.</T>
            </View>
            <Btn label="Iniciar jornada" icon="bolt" onPress={start} />
          </Panel>
        </Appear>
        <Appear delay={300}>
          <View style={{ gap: 10 }}>
            {[
              ['repeat', 'Lançamentos que repetem: mensal, parcelado ou até um mês.'],
              ['vault', 'Cofre de investimentos com rendimento e patrimônio total.'],
              ['target', 'Missões (metas) com progresso, XP e conquistas.'],
            ].map(([icon, text]) => (
              <Row key={icon} gap={12}>
                <Icon name={icon as 'repeat'} size={18} color={C.gold} />
                <T v="small" color={C.sub} style={{ flex: 1 }}>{text}</T>
              </Row>
            ))}
          </View>
        </Appear>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
