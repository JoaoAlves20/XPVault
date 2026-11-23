# XPVault

App Android de controle financeiro **offline-first** com cara de jogo: registre receitas e despesas, deixe lançamentos se repetirem sozinhos, acompanhe investimentos, cumpra missões (metas), ganhe XP e suba de nível.

Tudo fica salvo no próprio celular (SQLite). Não precisa de internet nem de conta.

## Funcionalidades

- **Receitas e despesas** com categoria, conta, data e situação (*pago/recebido* ou *previsto*).
- **Recorrência** em três modos:
  - **Mensal sem fim**: salário, aluguel…
  - **Parcelado**: "12x começando na parcela 5". Mostra `5/12` e para sozinho na última.
  - **Até um mês**: repete até o mês escolhido.

  Ao editar ou excluir, você escolhe o alcance: *só esta*, *esta e as próximas* ou *todas*.
- **Cofre de investimentos**: ativos, aportes, resgates, valor atual e rendimento. Aporte sai da conta mas **não conta como gasto**.
- **Balanço**: o quanto você recebeu, gastou e investiu, no mês ou desde o início. Patrimônio = contas + investimentos. Projeção do saldo no fim do mês.
- **Orçamentos como HP**: cada categoria com limite vira uma barra de vida que vai caindo conforme você gasta.
- **Missões**: metas com prazo, sugestão de quanto guardar por mês e progresso manual ou ligado a um ativo.
- **Gamificação**: XP, níveis e patentes, sequência de dias, conquistas e animações de level up.
- **Backup**: exporta e importa um arquivo JSON pelo menu de compartilhar (Drive, WhatsApp, e-mail…).

## Instalar no celular

1. Abra a [página de releases](../../releases) e baixe o `.apk` da release **latest**.
2. No Android, permita "instalar apps desconhecidos" para o navegador ou o gerenciador de arquivos.
3. Abra o APK e instale. Para atualizar, instale o APK novo por cima: os dados são mantidos.

> Os dados ficam **só no aparelho**. Faça um backup em *Configurações → Backup → Exportar* de vez em quando.

## Desenvolvimento

Pré-requisito: Node.js 22 ou superior.

```bash
git clone https://github.com/JoaoAlves20/XPVault.git
cd XPVault
npm install
npx tsc --noEmit          # checagem de tipos
npx expo export -p android  # testa o empacotamento do JS
```

O app usa módulos nativos (SQLite, fontes, compartilhamento), então **não roda no Expo Go**. Para testar mudanças:

- **Mais simples:** dê `git push` na `main`. O GitHub Actions compila o APK em ~10–15 min e publica na release `latest`.
- **Local**, se tiver Android Studio/SDK e JDK 17: `npx expo run:android` com o celular conectado por USB.

### Estrutura

```
App.tsx                 raiz: fontes, banco, navegação e sheets
src/theme.ts            cores e fontes
src/db/db.ts            abertura do SQLite, schema e migrações
src/db/repo.ts          consultas e regras de dados (recorrência, saldos, investimentos, metas, backup)
src/db/store.ts         useQuery(): telas recalculam quando os dados mudam
src/game/               XP, níveis, conquistas, efeitos e "actions" (escrita + XP + vibração)
src/screens/            Base, Extrato, Cofre, Missões, Boas-vindas
src/sheets/             painéis deslizantes (registrar, detalhes, editores, configurações)
src/ui/                 kit visual (painéis chanfrados, barras, anéis, ícones, dock, teclado)
```

### Build e assinatura

O workflow [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml):

1. roda `expo prebuild`;
2. aplica a chave de assinatura do segredo `XPV_KEYSTORE_B64`;
3. compila `assembleRelease` e publica o APK.

Use sempre a mesma chave: com outra assinatura o Android não deixa instalar por cima, e seria preciso desinstalar (perdendo os dados).

Ao mudar o schema do banco, adicione uma migração em `initDb()` (`src/db/db.ts`), incrementando `SCHEMA_VERSION`. Nunca altere o `SCHEMA_V1` já publicado.

## Roadmap

- [ ] Cartão de crédito com fatura (fechamento e vencimento)
- [ ] Transferência entre contas
- [ ] Bloqueio por PIN ou biometria
- [ ] Gráfico de evolução do patrimônio
- [ ] Dívidas como "chefões"
- [ ] Planejador financeiro: regras locais primeiro (alertas de gasto, ritmo das metas, 50/30/20), depois IA opcional
