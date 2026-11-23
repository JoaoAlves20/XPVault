import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, alpha } from '../theme';
import { fmt } from '../lib/money';
import {
  addDays, addMonths, daysInMonth, monthDiff, monthLabel, monthOf, monthShort, parseISO, shortDate, thisMonth, todayISO, WEEKDAYS_SHORT, relDay, dayLabel,
} from '../lib/dates';
import { useQuery } from '../db/store';
import * as R from '../db/repo';
import * as A from '../game/actions';
import { toast } from '../game/fx';
import { SheetFrame, useNav, useKeyboardHeight } from '../nav';
import { Keypad, KeypadKey } from '../ui/chrome';
import { Btn, Chip, CodeTile, IconBtn, Panel, Row, Segmented, Stepper, T } from '../ui/kit';
import { Icon } from '../ui/Icon';

type Mode = 'income' | 'expense' | 'invest';
const MODE_COLOR: Record<Mode, string> = { income: C.income, expense: C.expense, invest: C.invest };

export function AddEntrySheet({ mode: initMode, editId, assetId, moveKind, accountId }: { mode?: Mode; editId?: number; assetId?: number; moveKind?: 'aporte' | 'resgate'; accountId?: number }) {
  const nav = useNav();
  const kb = useKeyboardHeight();
  const editing = useMemo(() => (editId ? R.getTx(editId) : null), [editId]);
  const cats = useQuery(() => R.categories());
  const accs = useQuery(() => R.accounts());
  const assets = useQuery(() => R.assets());

  const [mode, setMode] = useState<Mode>(editing?.kind ?? initMode ?? 'expense');
  const [cents, setCents] = useState(editing?.amount_cents ?? 0);
  const [desc, setDesc] = useState(editing?.description ?? '');
  const [catId, setCatId] = useState<number | null>(editing?.category_id ?? null);
  const firstRegular = accs.find((a) => a.kind === 'regular')?.id ?? null;
  const [accId, setAccId] = useState<number | null>(editing?.account_id ?? accountId ?? firstRegular);
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [status, setStatus] = useState<'done' | 'planned'>(editing?.status === 'planned' ? 'planned' : 'done');
  const [repeat, setRepeat] = useState<'none' | 'forever' | 'count' | 'until'>('none');
  const [total, setTotal] = useState(12);
  const [firstN, setFirstN] = useState(1);
  const [until, setUntil] = useState(addMonths(thisMonth(), 11));
  const [scope, setScope] = useState<R.Scope>('one');
  const [assetSel, setAssetSel] = useState<number | null>(assetId ?? assets[0]?.id ?? null);
  const [mk, setMk] = useState<'aporte' | 'resgate'>(moveKind ?? 'aporte');
  const [showCal, setShowCal] = useState(false);

  const color = MODE_COLOR[mode];
  const modeCats = cats.filter((c) => c.kind === (mode === 'income' ? 'income' : 'expense'));

  useEffect(() => {
    if (mode === 'invest') return;
    if (!modeCats.some((c) => c.id === catId)) setCatId(modeCats[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cats.length]);

  useEffect(() => {
    if (!assetSel && assets.length) setAssetSel(assets[0].id);
  }, [assets, assetSel]);

  // Vales não podem ser origem/destino de aporte.
  const shownAccs = mode === 'invest' ? accs.filter((a) => a.kind === 'regular') : accs;
  useEffect(() => {
    if (mode === 'invest' && !shownAccs.some((a) => a.id === accId)) setAccId(firstRegular);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const pickDate = (d: string) => {
    setDate(d);
    if (!editing) setStatus(d > todayISO() ? 'planned' : 'done');
  };

  const onKey = (k: KeypadKey) => {
    setCents((c) => {
      const s = String(c);
      if (k === 'del') return Math.floor(c / 10);
      if (k === 'clr') return 0;
      const next = (c === 0 ? '' : s) + k;
      return next.length > 11 ? c : Number(next);
    });
  };

  const save = () => {
    if (cents <= 0) {
      toast('Digite um valor', C.warn);
      return;
    }
    if (mode === 'invest') {
      if (!assetSel) {
        toast('Cadastre um ativo primeiro', C.warn);
        return;
      }
      A.investMove({ asset_id: assetSel, kind: mk, amount_cents: cents, account_id: accId, date, note: desc.trim() });
      nav.close();
      return;
    }
    const kind = mode;
    if (editing) {
      A.updateEntry(editing.id, { kind, amount_cents: cents, description: desc.trim(), category_id: catId, account_id: accId, date, status }, scope);
    } else {
      const rp: R.Repeat =
        repeat === 'none' ? { mode: 'none' }
          : repeat === 'forever' ? { mode: 'forever' }
            : repeat === 'count' ? { mode: 'count', total, first: Math.min(firstN, total) }
              : { mode: 'until', until };
      A.addEntry({ kind, amount_cents: cents, description: desc.trim(), category_id: catId, account_id: accId, date, status, repeat: rp });
    }
    nav.close();
  };

  const untilCount = monthDiff(monthOf(date), until) + 1;
  const countN = total - Math.min(firstN, total) + 1;

  const footer = kb > 0 ? null : (
    <View>
      <AmountDisplay cents={cents} color={color} hint={
        !editing && mode !== 'invest' && repeat === 'count' ? `${countN}× = ${fmt(cents * countN)}`
          : !editing && mode !== 'invest' && repeat === 'until' && untilCount > 0 ? `${untilCount}× = ${fmt(cents * untilCount)}`
            : !editing && mode !== 'invest' && repeat === 'forever' ? 'todo mês' : undefined
      } />
      <Keypad onKey={onKey} onSubmit={save} color={color} submitLabel={editing ? 'SALVAR' : mode === 'invest' ? (mk === 'aporte' ? 'APORTAR' : 'RESGATAR') : 'REGISTRAR'} />
    </View>
  );

  return (
    <SheetFrame title={editing ? 'Editar lançamento' : 'Novo registro'} accent={color} full footer={footer}>
      <View style={{ gap: 18 }}>
        {editing ? (
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { id: 'income', label: 'Receita', color: C.income },
              { id: 'expense', label: 'Despesa', color: C.expense },
            ]}
          />
        ) : (
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { id: 'income', label: '▲ Receita', color: C.income },
              { id: 'expense', label: '▼ Despesa', color: C.expense },
              { id: 'invest', label: '◆ Aporte', color: C.invest },
            ]}
          />
        )}

        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder={mode === 'invest' ? 'Observação (opcional)' : 'Descrição (opcional)'}
          placeholderTextColor={C.mute}
          selectionColor={color}
          style={[styles.desc, { borderBottomColor: alpha(color, 0.5) }]}
        />

        {mode === 'invest' ? (
          <>
            <Segmented
              value={mk}
              onChange={setMk}
              options={[
                { id: 'aporte', label: 'Aportar', color: C.invest },
                { id: 'resgate', label: 'Resgatar', color: C.warn },
              ]}
            />
            <Block label="Ativo">
              <View style={styles.wrap}>
                {assets.map((a) => (
                  <Chip key={a.id} label={a.name} color={a.color} active={assetSel === a.id} onPress={() => setAssetSel(a.id)} leading={<View style={{ width: 8, height: 8, backgroundColor: a.color, transform: [{ rotate: '45deg' }] }} />} />
                ))}
                <Chip label="+ Novo ativo" color={C.invest} onPress={() => nav.open({ t: 'assetEdit' })} />
              </View>
            </Block>
          </>
        ) : (
          <Block label="Categoria">
            <View style={styles.wrap}>
              {modeCats.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} active={catId === c.id} onPress={() => setCatId(c.id)} leading={<CodeTile code={c.code} color={c.color} size={22} />} />
              ))}
              <Chip label="+" color={color} onPress={() => nav.open({ t: 'category', kind: mode === 'income' ? 'income' : 'expense' })} />
            </View>
          </Block>
        )}

        <Block label={mode === 'invest' ? (mk === 'aporte' ? 'Sai da conta' : 'Entra na conta') : 'Conta'}>
          <View style={styles.wrap}>
            {shownAccs.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                color={a.color}
                active={accId === a.id}
                onPress={() => setAccId(a.id)}
                leading={a.kind === 'benefit' ? <Text style={{ fontFamily: F.monoBold, fontSize: 9, color: accId === a.id ? a.color : C.mute, letterSpacing: 1 }}>VALE</Text> : undefined}
              />
            ))}
          </View>
          {accs.find((a) => a.id === accId)?.kind === 'benefit' ? (
            <T v="small" color={C.mute}>Vale: sai do saldo do vale e conta no orçamento da categoria, mas fica fora do patrimônio e dos totais.</T>
          ) : null}
        </Block>

        <Block label="Data">
          <View style={styles.wrap}>
            <Chip label="Ontem" active={date === addDays(todayISO(), -1)} onPress={() => pickDate(addDays(todayISO(), -1))} />
            <Chip label="Hoje" active={date === todayISO()} onPress={() => pickDate(todayISO())} />
            <Chip label="Amanhã" active={date === addDays(todayISO(), 1)} onPress={() => pickDate(addDays(todayISO(), 1))} />
            <Chip
              label={relDay(date) ? 'Outra data' : dayLabel(date)}
              active={!relDay(date) || showCal}
              onPress={() => setShowCal((s) => !s)}
              leading={<Icon name="calendar" size={14} color={!relDay(date) || showCal ? C.gold : C.sub} />}
            />
          </View>
          {showCal ? <MiniCalendar value={date} onChange={(d) => { pickDate(d); setShowCal(false); }} /> : null}
        </Block>

        {mode !== 'invest' ? (
          <Block label="Situação">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { id: 'done', label: mode === 'income' ? 'Recebido' : 'Pago', color: C.income },
                { id: 'planned', label: 'Previsto', color: C.warn },
              ]}
            />
          </Block>
        ) : null}

        {mode !== 'invest' && !editing ? (
          <Block label="Repetição">
            <Segmented
              value={repeat}
              onChange={setRepeat}
              color={C.goal}
              options={[
                { id: 'none', label: 'Não' },
                { id: 'forever', label: 'Mensal' },
                { id: 'count', label: 'Parcelas' },
                { id: 'until', label: 'Até' },
              ]}
            />
            {repeat === 'forever' ? (
              <T v="small" color={C.sub}>Repete todo mês, sem data para acabar (ex.: salário, aluguel). Você pode encerrar quando quiser.</T>
            ) : null}
            {repeat === 'count' ? (
              <View style={{ gap: 10 }}>
                <Row gap={10}>
                  <Stepper label="Total de parcelas" value={total} onChange={(v) => { setTotal(v); if (firstN > v) setFirstN(v); }} min={2} max={480} />
                  <Stepper label="Começa na parcela" value={firstN} onChange={setFirstN} min={1} max={total} />
                </Row>
                <T v="small" color={C.sub}>
                  Serão criadas <Text style={{ color: C.goal, fontFamily: F.bold }}>{countN} parcelas</Text> ({firstN}/{total} até {total}/{total}), uma por mês, terminando em{' '}
                  <Text style={{ color: C.goal, fontFamily: F.bold }}>{monthLabel(addMonths(monthOf(date), countN - 1))}</Text>.
                </T>
              </View>
            ) : null}
            {repeat === 'until' ? (
              <View style={{ gap: 10 }}>
                <MonthStepper value={until} onChange={setUntil} min={monthOf(date)} />
                <T v="small" color={C.sub}>
                  Repete todo mês até <Text style={{ color: C.goal, fontFamily: F.bold }}>{monthLabel(until)}</Text> ({Math.max(0, untilCount)} vezes) e para sozinho.
                </T>
              </View>
            ) : null}
          </Block>
        ) : null}

        {editing && editing.recurrence_id ? (
          <Block label="Aplicar alteração em">
            <Segmented
              value={scope}
              onChange={setScope}
              color={C.goal}
              options={[
                { id: 'one', label: 'Só esta' },
                { id: 'future', label: 'Próximas' },
                { id: 'all', label: 'Todas' },
              ]}
            />
            <T v="small" color={C.mute}>"Próximas" altera esta e as seguintes. Data e situação mudam só nesta.</T>
          </Block>
        ) : null}
      </View>
    </SheetFrame>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T v="label" color={C.mute}>{label}</T>
      {children}
    </View>
  );
}

function AmountDisplay({ cents, color, hint }: { cents: number; color: string; hint?: string }) {
  const blink = useRef(new Animated.Value(1)).current;
  const bump = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, [blink]);
  useEffect(() => {
    bump.setValue(1.06);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  }, [cents, bump]);
  const text = fmt(cents, { symbol: false });
  return (
    <View style={styles.amountWrap}>
      <Text style={{ fontFamily: F.monoBold, fontSize: 16, color: alpha(color, 0.6), marginRight: 6, marginTop: 8 }}>R$</Text>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.monoBold, fontSize: 40, color: cents ? color : C.mute, letterSpacing: -1.5, transform: [{ scale: bump }], flexShrink: 1 }}>
        {text}
      </Animated.Text>
      <Animated.View style={{ width: 3, height: 36, backgroundColor: color, marginLeft: 4, opacity: blink }} />
      <View style={{ flex: 1 }} />
      {hint ? <Text style={{ fontFamily: F.monoBold, fontSize: 11, color: C.goal, marginLeft: 8 }}>{hint}</Text> : null}
    </View>
  );
}

export function MonthStepper({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <View style={styles.monthStep}>
      <IconBtn icon="chevL" onPress={() => onChange(min && addMonths(value, -1) < min ? value : addMonths(value, -1))} size={40} />
      <Pressable onLongPress={() => onChange(addMonths(value, 12))} style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 18, color: C.text }}>{monthLabel(value)}</Text>
      </Pressable>
      <IconBtn icon="chevR" onPress={() => onChange(addMonths(value, 1))} size={40} />
    </View>
  );
}

export function MiniCalendar({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [ym, setYm] = useState(monthOf(value));
  const first = parseISO(`${ym}-01`).getDay();
  const n = daysInMonth(ym);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = todayISO();
  return (
    <Panel pad={12} c={10} style={{ marginTop: 4 }}>
      <Row style={{ marginBottom: 8 }}>
        <IconBtn icon="chevL" onPress={() => setYm(addMonths(ym, -1))} size={34} />
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.bold, color: C.text, fontSize: 15 }}>{monthLabel(ym)}</Text>
        <IconBtn icon="chevR" onPress={() => setYm(addMonths(ym, 1))} size={34} />
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS_SHORT.map((w) => (
          <Text key={w} style={styles.calHead}>{w[0]}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.calCell} />;
          const iso = `${ym}-${String(d).padStart(2, '0')}`;
          const sel = iso === value;
          return (
            <Pressable key={i} style={styles.calCell} onPress={() => onChange(iso)}>
              <View style={[styles.calDay, sel && { backgroundColor: C.gold }, iso === today && !sel && { borderColor: C.gold, borderWidth: 1 }]}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 13, color: sel ? C.bg : C.text }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

// ───────────────────────── Detalhe do lançamento ─────────────────────────
export function TxSheet({ id }: { id: number }) {
  const nav = useNav();
  const t = useQuery(() => R.getTx(id), [id]);
  const [askScope, setAskScope] = useState(false);

  if (!t || t.status === 'skipped') {
    return (
      <SheetFrame title="Lançamento">
        <T v="body" color={C.sub}>Este lançamento não existe mais.</T>
      </SheetFrame>
    );
  }
  const color = t.kind === 'income' ? C.income : C.expense;
  const badge = R.recurrenceBadge(t);
  const recText =
    t.rec_mode === 'count' ? `Parcela ${badge}`
      : t.rec_mode === 'until' ? `Mensal até ${t.rec_until ? monthShort(t.rec_until) : '—'} · ocorrência ${t.seq}`
        : t.rec_mode === 'forever' ? 'Mensal, sem fim'
          : 'Não repete';

  const del = (scope: R.Scope) => {
    A.deleteEntry(t.id, scope);
    nav.close();
  };

  return (
    <SheetFrame title={t.kind === 'income' ? 'Receita' : 'Despesa'} accent={color}>
      <View style={{ gap: 16 }}>
        <Row gap={14}>
          <CodeTile code={t.cat_code ?? '—'} color={t.cat_color ?? color} size={52} />
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={2}>{t.description || t.cat_name || 'Sem descrição'}</T>
            <Text style={{ fontFamily: F.monoBold, fontSize: 28, color, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
              {t.kind === 'income' ? '+' : '−'}{fmt(t.amount_cents)}
            </Text>
          </View>
        </Row>

        <Panel pad={4} c={10}>
          <Info label="Categoria" value={t.cat_name ?? '—'} />
          <Info label="Conta" value={t.acc_name ?? '—'} />
          <Info label="Data" value={`${dayLabel(t.date)}${relDay(t.date) ? ' · ' + relDay(t.date) : ''} · ${shortDate(t.date)}`} />
          <Info label="Situação" value={t.status === 'done' ? (t.kind === 'income' ? 'Recebido' : 'Pago') : 'Previsto'} color={t.status === 'done' ? C.income : C.warn} />
          <Info label="Repetição" value={recText} color={t.rec_mode ? C.goal : undefined} last />
        </Panel>

        {t.status === 'planned' ? (
          <Btn label={t.kind === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'} icon="check" color={C.income} onPress={() => { A.confirmEntry(t.id); nav.close(); }} />
        ) : (
          <Btn label="Voltar para previsto" variant="outline" color={C.warn} onPress={() => A.unconfirmEntry(t.id)} />
        )}

        <Row>
          <Btn label="Editar" icon="edit" variant="ghost" color={C.text} onPress={() => nav.swap({ t: 'add', editId: t.id })} style={{ flex: 1 }} />
          <Btn
            label="Excluir"
            icon="trash"
            variant="ghost"
            color={C.expense}
            style={{ flex: 1 }}
            onPress={() => {
              if (t.recurrence_id) setAskScope((s) => !s);
              else Alert.alert('Excluir lançamento?', 'Essa ação não pode ser desfeita.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => del('one') }]);
            }}
          />
        </Row>

        {askScope ? (
          <Panel stroke={alpha(C.expense, 0.5)} style={{ gap: 10 }}>
            <T v="label" color={C.expense}>Excluir qual parte da repetição?</T>
            <Btn label="Só esta ocorrência" variant="outline" color={C.expense} small onPress={() => del('one')} />
            <Btn label="Esta e as próximas (encerra)" variant="outline" color={C.expense} small onPress={() => del('future')} />
            <Btn label="Todas, inclusive as passadas" color={C.expense} small onPress={() => del('all')} />
          </Panel>
        ) : null}
      </View>
    </SheetFrame>
  );
}

function Info({ label, value, color = C.text, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <View style={[styles.info, last && { borderBottomWidth: 0 }]}>
      <T v="label" color={C.mute} style={{ width: 96 }}>{label}</T>
      <Text style={{ flex: 1, fontFamily: F.med, fontSize: 14, color, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  desc: { fontFamily: F.med, fontSize: 18, color: C.text, borderBottomWidth: 1, paddingVertical: 8 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  monthStep: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg2, padding: 6 },
  calHead: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: F.monoBold, fontSize: 10, color: C.mute, marginBottom: 4 },
  calCell: { width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' },
  calDay: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line },
});
