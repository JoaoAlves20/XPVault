import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { C, F, SWATCHES, alpha } from '../theme';
import { fmt, pct } from '../lib/money';
import { addMonths, monthDiff, monthLabel, shortDate, thisMonth, todayISO } from '../lib/dates';
import { useQuery } from '../db/store';
import { getMeta, setMeta } from '../db/db';
import * as R from '../db/repo';
import * as A from '../game/actions';
import { toast } from '../game/fx';
import { exportBackup, pickBackup } from '../lib/backup';
import { SheetFrame, useNav } from '../nav';
import { Btn, Chip, CodeTile, Field, MoneyField, Panel, Press, Ring, Row, SectionTitle, Segmented, Swatches, T } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { MonthStepper } from './Entry';

const confirm = (title: string, msg: string, ok: string, onOk: () => void) =>
  Alert.alert(title, msg, [{ text: 'Cancelar', style: 'cancel' }, { text: ok, style: 'destructive', onPress: onOk }]);

// ───────────────────────── Ativo: editar ─────────────────────────
export function AssetEditSheet({ id }: { id?: number }) {
  const nav = useNav();
  const existing = id ? R.getAsset(id) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<R.AssetType>(existing?.type ?? 'rf');
  const [color, setColor] = useState(existing?.color ?? C.invest);
  const [initial, setInitial] = useState(0);

  const save = () => {
    if (!name.trim()) return toast('Dê um nome ao ativo', C.warn);
    A.write(() => R.saveAsset({ id, name: name.trim(), type, color }, id ? undefined : { amount_cents: initial, date: todayISO() }));
    nav.close();
  };

  return (
    <SheetFrame title={id ? 'Editar ativo' : 'Novo ativo'} accent={C.invest}>
      <View style={{ gap: 18 }}>
        <Field label="Nome" value={name} onChange={setName} placeholder="Ex.: CDB Nubank, Tesouro Selic, PETR4" autoFocus={!id} />
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Tipo</T>
          <View style={styles.wrap}>
            {R.ASSET_TYPES.map((t) => (
              <Chip key={t.id} label={t.label} color={C.invest} active={type === t.id} onPress={() => setType(t.id)} />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Cor</T>
          <Swatches value={color} onChange={setColor} colors={SWATCHES} />
        </View>
        {!id ? (
          <View style={{ gap: 6 }}>
            <MoneyField label="Já tem valor aplicado? (opcional)" value={initial} onChange={setInitial} color={C.invest} />
            <T v="small" color={C.mute}>Entra como investido sem sair de nenhuma conta. Novos aportes você faz pelo botão Aporte.</T>
          </View>
        ) : null}
        <Btn label="Salvar ativo" icon="check" color={C.invest} onPress={save} />
        {id ? (
          <Btn label="Excluir ativo" icon="trash" variant="ghost" color={C.expense} onPress={() => confirm('Excluir ativo?', 'Todo o histórico de aportes e resgates deste ativo será apagado.', 'Excluir', () => { A.write(() => R.deleteAsset(id)); nav.close(); nav.close(); })} />
        ) : null}
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Ativo: detalhe ─────────────────────────
export function AssetSheet({ id }: { id: number }) {
  const nav = useNav();
  const d = useQuery(() => ({ a: R.getAsset(id), moves: R.assetMoves(id) }), [id]);
  const [val, setVal] = useState<number | null>(null);
  const a = d.a;
  if (!a) {
    return (
      <SheetFrame title="Ativo">
        <T v="body" color={C.sub}>Ativo removido.</T>
      </SheetFrame>
    );
  }
  const gain = a.current_cents - a.invested;
  return (
    <SheetFrame title={R.assetTypeLabel(a.type)} accent={a.color}>
      <View style={{ gap: 16 }}>
        <View>
          <T v="h2">{a.name}</T>
          <Text style={{ fontFamily: F.monoBold, fontSize: 32, color: C.text, letterSpacing: -1, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{fmt(a.current_cents)}</Text>
          <Row gap={16} style={{ marginTop: 4 }}>
            <Text style={styles.kv}>investido <Text style={{ color: C.invest }}>{fmt(a.invested)}</Text></Text>
            <Text style={styles.kv}>
              <Text style={{ color: gain >= 0 ? C.income : C.expense }}>{fmt(gain, { sign: true })}</Text>
              {a.invested > 0 ? ` (${pct(gain / a.invested)})` : ''}
            </Text>
          </Row>
        </View>

        <Row>
          <Btn label="Aporte" icon="up" color={C.invest} style={{ flex: 1 }} onPress={() => nav.open({ t: 'add', mode: 'invest', assetId: a.id, moveKind: 'aporte' })} />
          <Btn label="Resgate" icon="down" color={C.warn} variant="outline" style={{ flex: 1 }} onPress={() => nav.open({ t: 'add', mode: 'invest', assetId: a.id, moveKind: 'resgate' })} />
        </Row>

        <Panel pad={14} style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Atualizar valor atual</T>
          <T v="small" color={C.sub}>Olhe o saldo no app do banco/corretora e informe aqui — assim o XPVault calcula seu rendimento.</T>
          <MoneyField label="Valor atual" value={val ?? a.current_cents} onChange={setVal} color={C.invest} />
          <Btn
            label="Salvar valor"
            small
            color={C.invest}
            variant="ghost"
            disabled={val == null || val === a.current_cents}
            onPress={() => {
              if (val == null) return;
              A.write(() => R.setAssetValue(a.id, val));
              setVal(null);
              toast('Valor atualizado', C.invest);
            }}
          />
        </Panel>

        <SectionTitle title="Histórico" right={<Text onPress={() => nav.open({ t: 'assetEdit', id: a.id })} style={styles.link}>EDITAR ATIVO</Text>} />
        {d.moves.length === 0 ? <T v="small" color={C.mute}>Sem movimentações.</T> : null}
        <View style={{ gap: 6 }}>
          {d.moves.map((m) => (
            <Press
              key={m.id}
              onLongPress={() => confirm('Apagar movimentação?', `${m.kind === 'aporte' ? 'Aporte' : 'Resgate'} de ${fmt(m.amount_cents)} em ${shortDate(m.date)}.`, 'Apagar', () => A.write(() => R.deleteAssetMove(m.id)))}
            >
              <View style={styles.moveRow}>
                <Icon name={m.kind === 'aporte' ? 'up' : 'down'} size={16} color={m.kind === 'aporte' ? C.invest : C.warn} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.med, color: C.text, fontSize: 14 }}>{m.kind === 'aporte' ? 'Aporte' : 'Resgate'}</Text>
                  <Text style={{ fontFamily: F.reg, color: C.mute, fontSize: 12 }}>{shortDate(m.date)} · {m.acc_name ?? (m.note || 'sem conta')}</Text>
                </View>
                <Text style={{ fontFamily: F.monoBold, color: m.kind === 'aporte' ? C.invest : C.warn, fontSize: 14 }}>
                  {m.kind === 'aporte' ? '+' : '−'}{fmt(m.amount_cents, { symbol: false })}
                </Text>
              </View>
            </Press>
          ))}
        </View>
        {d.moves.length ? <T v="small" color={C.mute}>Segure uma movimentação para apagá-la.</T> : null}
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Meta: editar ─────────────────────────
export function GoalEditSheet({ id }: { id?: number }) {
  const nav = useNav();
  const existing = id ? R.getGoal(id) : null;
  const assets = useQuery(() => R.assets());
  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing?.target_cents ?? 0);
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ?? addMonths(thisMonth(), 12));
  const [color, setColor] = useState(existing?.color ?? C.goal);
  const [link, setLink] = useState<'manual' | 'asset'>(existing?.asset_id ? 'asset' : 'manual');
  const [assetId, setAssetId] = useState<number | null>(existing?.asset_id ?? assets[0]?.id ?? null);
  const [initial, setInitial] = useState(0);

  const save = () => {
    if (!name.trim()) return toast('Dê um nome à missão', C.warn);
    if (target <= 0) return toast('Defina o valor alvo', C.warn);
    if (link === 'asset' && !assetId) return toast('Escolha um ativo', C.warn);
    A.write(() =>
      R.saveGoal({ id, name: name.trim(), target_cents: target, deadline: hasDeadline ? deadline : null, color, asset_id: link === 'asset' ? assetId : null }, initial),
    );
    nav.close();
  };

  return (
    <SheetFrame title={id ? 'Editar missão' : 'Nova missão'} accent={color}>
      <View style={{ gap: 18 }}>
        <Field label="Nome da missão" value={name} onChange={setName} placeholder="Ex.: Reserva de emergência" autoFocus={!id} />
        <MoneyField label="Valor alvo" value={target} onChange={setTarget} color={color} />
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Prazo</T>
          <Segmented value={hasDeadline ? 'y' : 'n'} onChange={(v) => setHasDeadline(v === 'y')} color={color} options={[{ id: 'n', label: 'Sem prazo' }, { id: 'y', label: 'Com prazo' }]} />
          {hasDeadline ? (
            <>
              <MonthStepper value={deadline} onChange={setDeadline} min={thisMonth()} />
              {target > 0 ? (
                <T v="small" color={C.sub}>
                  Para chegar em {monthLabel(deadline)}: guarde ~<Text style={{ color, fontFamily: F.bold }}>{fmt(Math.ceil(Math.max(0, target - (existing?.progress_cents ?? initial)) / Math.max(1, monthDiff(thisMonth(), deadline) + 1)))}</Text>/mês.
                </T>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Progresso</T>
          <Segmented value={link} onChange={setLink} color={color} options={[{ id: 'manual', label: 'Eu registro' }, { id: 'asset', label: 'Segue um ativo' }]} />
          {link === 'asset' ? (
            assets.length ? (
              <View style={styles.wrap}>
                {assets.map((a) => (
                  <Chip key={a.id} label={a.name} color={a.color} active={assetId === a.id} onPress={() => setAssetId(a.id)} />
                ))}
              </View>
            ) : (
              <T v="small" color={C.warn}>Você ainda não tem ativos no Cofre.</T>
            )
          ) : !id ? (
            <MoneyField label="Já tem algo guardado? (opcional)" value={initial} onChange={setInitial} color={color} />
          ) : null}
          <T v="small" color={C.mute}>
            {link === 'asset' ? 'O progresso acompanha o valor atual do ativo escolhido.' : 'Você adiciona valores manualmente conforme for guardando.'}
          </T>
        </View>
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Cor</T>
          <Swatches value={color} onChange={setColor} colors={SWATCHES} />
        </View>
        <Btn label="Salvar missão" icon="check" color={color} onPress={save} />
        {id ? (
          <Btn label="Excluir missão" icon="trash" variant="ghost" color={C.expense} onPress={() => confirm('Excluir missão?', 'O progresso registrado será apagado.', 'Excluir', () => { A.write(() => R.deleteGoal(id)); nav.close(); nav.close(); })} />
        ) : null}
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Meta: detalhe ─────────────────────────
export function GoalSheet({ id }: { id: number }) {
  const nav = useNav();
  const g = useQuery(() => R.getGoal(id), [id]);
  const [amount, setAmount] = useState(0);
  if (!g) {
    return (
      <SheetFrame title="Missão">
        <T v="body" color={C.sub}>Missão removida.</T>
      </SheetFrame>
    );
  }
  const p = g.target_cents > 0 ? g.progress_cents / g.target_cents : 0;
  const left = Math.max(0, g.target_cents - g.progress_cents);
  const months = g.deadline ? monthDiff(thisMonth(), g.deadline) + 1 : null;
  const done = !!g.completed_at;
  return (
    <SheetFrame title={done ? 'Missão cumprida' : 'Missão'} accent={done ? C.income : g.color}>
      <View style={{ gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Ring size={150} stroke={10} progress={p} color={done ? C.income : g.color}>
            <Text style={{ fontFamily: F.monoBold, fontSize: 32, color: done ? C.income : g.color }}>{Math.floor(p * 100)}%</Text>
          </Ring>
          <T v="h2" style={{ textAlign: 'center' }}>{g.name}</T>
          <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.sub }}>{fmt(g.progress_cents)} de {fmt(g.target_cents)}</Text>
          {!done ? (
            <T v="small" color={C.sub} style={{ textAlign: 'center' }}>
              Faltam <Text style={{ color: C.text, fontFamily: F.bold }}>{fmt(left)}</Text>
              {months && months > 0 ? <> · ~<Text style={{ color: g.color, fontFamily: F.bold }}>{fmt(Math.ceil(left / months))}</Text>/mês até {monthLabel(g.deadline!)}</> : null}
            </T>
          ) : null}
        </View>

        {g.asset_id ? (
          <Panel pad={14} style={{ gap: 10 }}>
            <Row>
              <Icon name="link" size={16} color={C.invest} />
              <T v="small" color={C.sub} style={{ flex: 1 }}>Progresso segue o ativo <Text style={{ color: C.invest, fontFamily: F.bold }}>{g.asset_name}</Text>.</T>
            </Row>
            <Btn label="Aportar neste ativo" icon="up" color={C.invest} small onPress={() => nav.open({ t: 'add', mode: 'invest', assetId: g.asset_id!, moveKind: 'aporte' })} />
          </Panel>
        ) : (
          <Panel pad={14} style={{ gap: 10 }}>
            <MoneyField label="Valor" value={amount} onChange={setAmount} color={g.color} />
            <Row>
              <Btn label="Guardar" icon="up" color={g.color} style={{ flex: 1 }} disabled={amount <= 0} onPress={() => { A.goalDeposit(g.id, amount); setAmount(0); }} />
              <Btn label="Retirar" icon="down" color={C.warn} variant="outline" style={{ flex: 1 }} disabled={amount <= 0} onPress={() => { A.goalDeposit(g.id, -amount); setAmount(0); }} />
            </Row>
          </Panel>
        )}

        <Row>
          <Btn label="Editar" icon="edit" variant="ghost" color={C.text} style={{ flex: 1 }} onPress={() => nav.open({ t: 'goalEdit', id: g.id })} />
          {done ? <Btn label="Reabrir" variant="ghost" color={C.warn} style={{ flex: 1 }} onPress={() => { R.reopenGoal(g.id); A.write(() => null); }} /> : null}
        </Row>
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Configurações ─────────────────────────
export function SettingsSheet() {
  const nav = useNav();
  const [kind, setKind] = useState<R.Kind>('expense');
  const d = useQuery(() => ({ accs: R.accounts(), cats: R.categories(), name: getMeta('player_name') ?? '' }));
  const [name, setName] = useState(d.name);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
      setMeta('last_backup', todayISO());
    } catch (e) {
      Alert.alert('Não foi possível exportar', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const doImport = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      confirm('Restaurar backup?', 'TODOS os dados atuais serão substituídos pelos do arquivo.', 'Restaurar', () => {
        try {
          A.restore(data);
          toast('Backup restaurado', C.income);
          nav.close();
        } catch (e) {
          Alert.alert('Backup inválido', String((e as Error).message ?? e));
        }
      });
    } catch (e) {
      Alert.alert('Não foi possível ler o arquivo', String((e as Error).message ?? e));
    }
  };
  const lastBackup = getMeta('last_backup');

  return (
    <SheetFrame title="Configurações" accent={C.gold}>
      <View style={{ gap: 4 }}>
        <Field label="Nome do jogador" value={name} onChange={setName} autoCapitalize="words" />
        {name.trim() && name.trim() !== d.name ? (
          <View style={{ marginTop: 8 }}>
            <Btn label="Salvar nome" small onPress={() => A.write(() => setMeta('player_name', name.trim()))} />
          </View>
        ) : null}

        <SectionTitle title="Contas" right={<Text onPress={() => nav.open({ t: 'account' })} style={styles.link}>+ CONTA</Text>} />
        <View style={{ gap: 6 }}>
          {d.accs.map((a) => (
            <Press key={a.id} onPress={() => nav.open({ t: 'account', id: a.id })}>
              <View style={styles.listRow}>
                <View style={{ width: 10, height: 10, backgroundColor: a.color, transform: [{ rotate: '45deg' }] }} />
                <Text style={styles.listName}>{a.name}</Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: a.balance >= 0 ? C.text : C.expense }}>{fmt(a.balance)}</Text>
              </View>
            </Press>
          ))}
        </View>

        <SectionTitle title="Categorias e orçamentos" right={<Text onPress={() => nav.open({ t: 'category', kind })} style={styles.link}>+ CATEGORIA</Text>} />
        <Segmented value={kind} onChange={setKind} options={[{ id: 'expense', label: 'Despesas', color: C.expense }, { id: 'income', label: 'Receitas', color: C.income }]} />
        <View style={{ gap: 6, marginTop: 10 }}>
          {d.cats.filter((c) => c.kind === kind).map((c) => (
            <Press key={c.id} onPress={() => nav.open({ t: 'category', id: c.id })}>
              <View style={styles.listRow}>
                <CodeTile code={c.code} color={c.color} size={32} />
                <Text style={styles.listName}>{c.name}</Text>
                {c.kind === 'expense' ? (
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: c.budget_cents ? C.sub : C.mute }}>{c.budget_cents ? `limite ${fmt(c.budget_cents, { compact: true })}` : 'sem limite'}</Text>
                ) : null}
                <Icon name="chevR" size={14} color={C.mute} />
              </View>
            </Press>
          ))}
        </View>

        <SectionTitle title="Backup" />
        <Panel pad={14} style={{ gap: 10 }}>
          <T v="small" color={C.sub}>
            Seus dados ficam só neste celular. Exporte um backup de vez em quando e guarde no Drive, e-mail ou WhatsApp.
          </T>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: lastBackup ? C.mute : C.warn }}>{lastBackup ? `último backup: ${shortDate(lastBackup)}` : 'nenhum backup feito ainda'}</Text>
          <Row>
            <Btn label="Exportar" icon="upload" small color={C.gold} style={{ flex: 1 }} disabled={busy} onPress={doExport} />
            <Btn label="Importar" icon="download" small variant="outline" color={C.gold} style={{ flex: 1 }} onPress={doImport} />
          </Row>
        </Panel>

        <SectionTitle title="Zona de perigo" color={C.expense} />
        <Btn
          label="Apagar todos os dados"
          icon="trash"
          variant="ghost"
          color={C.expense}
          onPress={() =>
            confirm('Apagar TUDO?', 'Lançamentos, investimentos, missões e XP serão apagados. Faça um backup antes.', 'Continuar', () =>
              confirm('Tem certeza absoluta?', 'Não dá para desfazer.', 'Apagar tudo', () => {
                A.resetAll();
                nav.close();
              }),
            )
          }
        />
        <T v="small" color={C.mute} style={{ textAlign: 'center', marginTop: 18 }}>XPVault v1.0 · offline-first</T>
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Categoria ─────────────────────────
const autoCode = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase();

export function CategorySheet({ id, kind: initKind }: { id?: number; kind?: R.Kind }) {
  const nav = useNav();
  const existing = id ? R.categories().find((c) => c.id === id) ?? null : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<R.Kind>(existing?.kind ?? initKind ?? 'expense');
  const [code, setCode] = useState(existing?.code ?? '');
  const [codeTouched, setCodeTouched] = useState(!!existing);
  const [color, setColor] = useState(existing?.color ?? SWATCHES[0]);
  const [budget, setBudget] = useState(existing?.budget_cents ?? 0);

  const shownCode = codeTouched ? code : autoCode(name);
  const save = () => {
    if (!name.trim()) return toast('Dê um nome à categoria', C.warn);
    A.write(() => R.saveCategory({ id, name: name.trim(), kind, code: (shownCode || 'CAT').toUpperCase(), color, budget_cents: kind === 'expense' && budget > 0 ? budget : null }));
    nav.close();
  };

  return (
    <SheetFrame title={id ? 'Editar categoria' : 'Nova categoria'} accent={color}>
      <View style={{ gap: 18 }}>
        <Row gap={14}>
          <CodeTile code={shownCode || '—'} color={color} size={56} />
          <View style={{ flex: 1 }}>
            <Field label="Nome" value={name} onChange={setName} placeholder="Ex.: Pets" autoFocus={!id} />
          </View>
        </Row>
        {!id ? (
          <Segmented value={kind} onChange={setKind} options={[{ id: 'expense', label: 'Despesa', color: C.expense }, { id: 'income', label: 'Receita', color: C.income }]} />
        ) : null}
        <Field label="Código (até 3 letras)" value={shownCode} onChange={(v) => { setCodeTouched(true); setCode(v.toUpperCase()); }} maxLength={3} autoCapitalize="characters" />
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Cor</T>
          <Swatches value={color} onChange={setColor} colors={SWATCHES} />
        </View>
        {kind === 'expense' ? (
          <View style={{ gap: 6 }}>
            <MoneyField label="Limite mensal (orçamento)" value={budget} onChange={setBudget} color={C.income} />
            <T v="small" color={C.mute}>Com limite, a categoria vira uma barra de HP na Base. Deixe 0 para não ter limite.</T>
          </View>
        ) : null}
        <Btn label="Salvar" icon="check" color={color} onPress={save} />
        {id ? (
          <Btn label="Remover categoria" icon="trash" variant="ghost" color={C.expense} onPress={() => confirm('Remover categoria?', 'Os lançamentos antigos continuam, mas ela some das opções.', 'Remover', () => { A.write(() => R.removeCategory(id)); nav.close(); })} />
        ) : null}
      </View>
    </SheetFrame>
  );
}

// ───────────────────────── Conta ─────────────────────────
export function AccountSheet({ id }: { id?: number }) {
  const nav = useNav();
  const existing = id ? R.accounts().find((a) => a.id === id) ?? null : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? SWATCHES[2]);
  const [initial, setInitial] = useState(existing?.initial_cents ?? 0);

  const save = () => {
    if (!name.trim()) return toast('Dê um nome à conta', C.warn);
    A.write(() => R.saveAccount({ id, name: name.trim(), color, initial_cents: initial }));
    nav.close();
  };
  return (
    <SheetFrame title={id ? 'Editar conta' : 'Nova conta'} accent={color}>
      <View style={{ gap: 18 }}>
        <Field label="Nome" value={name} onChange={setName} placeholder="Ex.: Nubank, Itaú, Carteira" autoFocus={!id} />
        <View style={{ gap: 6 }}>
          <MoneyField label="Saldo inicial" value={initial} onChange={setInitial} />
          <T v="small" color={C.mute}>Quanto tinha nesta conta antes de começar a usar o XPVault.</T>
        </View>
        {existing ? (
          <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.sub }}>Saldo atual: <Text style={{ color: C.text }}>{fmt(existing.balance - existing.initial_cents + initial)}</Text></Text>
        ) : null}
        <View style={{ gap: 10 }}>
          <T v="label" color={C.mute}>Cor</T>
          <Swatches value={color} onChange={setColor} colors={SWATCHES} />
        </View>
        <Btn label="Salvar" icon="check" color={color} onPress={save} />
        {id ? (
          <Btn
            label="Remover conta"
            icon="trash"
            variant="ghost"
            color={C.expense}
            onPress={() =>
              confirm('Remover conta?', 'Se ela tiver lançamentos, será apenas arquivada.', 'Remover', () => {
                const r = A.write(() => R.removeAccount(id));
                toast(r === 'archived' ? 'Conta arquivada' : 'Conta removida', C.sub);
                nav.close();
              })
            }
          />
        ) : null}
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { fontFamily: F.monoBold, fontSize: 10.5, letterSpacing: 1.2, color: C.gold },
  kv: { fontFamily: F.mono, fontSize: 13, color: C.mute },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: alpha(C.line, 1) },
  listName: { flex: 1, fontFamily: F.med, fontSize: 15, color: C.text },
});
