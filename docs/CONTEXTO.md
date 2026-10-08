# Contexto do projecto — Aplicativo de Taxi

Documento de passagem: reúne a análise, a pesquisa e as decisões tomadas até
agora, para continuar o trabalho noutro repositório ou noutra sessão.

Data: 8 de Outubro de 2026.

## 1. Ponto de partida: análise de um app concorrente

Analisámos uma gravação de ecrã (~1min35s) do **Heetch em Luanda**, que usa
**preço negociado** (estilo inDrive): o passageiro propõe um preço, os
motoristas aceitam ou fazem contraproposta.

Fluxo observado: rota → preço recomendado (4 900 AOA, mínimo 4 500) →
confirmar partida → à espera de propostas (janela de 7 min) → contraproposta de
um motorista (5 200 AOA) → aceitar → "motorista a caminho" → cancelamento com
motivo → nova viagem.

Problemas encontrados (e que o nosso app evita):

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | Aceitou-se a proposta de um motorista mas a viagem foi atribuída a **outro** | Alta |
| 2 | Proposta aceite a **5 200 AOA**, resumo mostra **4 500 AOA** | Alta |
| 3 | Banner "Ocorreu um erro" **ao mesmo tempo** que "Motorista a caminho" | Alta |
| 4 | Cancelamento sem clareza sobre custos/quem vem a caminho | Média |
| 5 | "Os preços foram actualizados" sem dizer o quê | Baixa |
| 6 | Ecrã de confirmar partida com zoom excessivo | Baixa |
| 7 | Mistura de PT-PT e PT-BR | Baixa |

Causa provável de 1–3: corrida entre a aceitação manual e a "aceitação
automática", sem uma operação atómica no servidor.

## 2. Pesquisa de mercado (fontes de 2020–2023; confirmar valores actuais)

**Modelos de app:**
- *Preço fixado pelo app* (Uber, Yango): o sistema calcula o preço e escolhe o
  motorista; preço dinâmico quando há muita procura.
- *Preço negociado* (inDrive, Heetch no vídeo): passageiro propõe, motoristas
  aceitam/contrapropõem sem penalização, passageiro escolhe por preço, tempo de
  chegada, carro e avaliação. Sem preço dinâmico.

**Luanda:**
- Concorrentes: Heetch (desde 2020), Yango (desde 2022), T'Leva, Ugo, Tirosa.
  Nove empresas a operar, só quatro registadas no Ministério dos Transportes.
- Comissões (2022): Heetch 11,4%, Yango 13%, Ugo e Tirosa 20%.
- Preços (2022): média mais barata ~182 Kz/km; Yango mínimo 560 Kz por 5 km.
- Yango trabalha com empresas parceiras (ex.: 120 000 Kz/semana ao motorista).
- Motoristas queixam-se de inflação, combustível e taxas; paralisação em 2023
  impedida pela polícia.
- Regulação do táxi por aplicativo em preparação (sem confirmação de
  aprovação). Mototáxi já regulado (Decreto Presidencial 123/22).

**Pagamentos:**
- Dinheiro é o mais comum.
- Multicaixa Express: assíncrono, 90 s para o cliente autorizar; referência não
  pode mudar de meio de pagamento. Integração prática via agregador (ex.:
  Paybyrd). Unitel isenta dados no uso do Multicaixa Express.

Fontes principais: Expansão, Ver Angola, Forbes África Lusófona, documentação
Paybyrd, SmartCompany/Fox Business/Zee5 (inDrive).

## 3. Decisões de produto

1. Modelo de **preço negociado**, com preço recomendado, mínimo, +/−,
   contrapropostas e aceitação automática opcional.
2. **Comissão baixa e transparente** (meta: 8–10%) como argumento para motoristas.
3. Primeiro lançamento pequeno: uma zona de Luanda, só categoria económica, só
   pagamento em dinheiro. Recrutar 20–50 motoristas antes de lançar.
4. Mostrar nas propostas: preço, tempo de chegada, carro e (a fazer) avaliação
   e número de viagens do motorista.
5. Português de Angola/Portugal consistente.
6. Mais tarde: Multicaixa Express via agregador, com confirmação no servidor;
   verificação de documentos dos motoristas; botão de emergência.

## 4. Decisões técnicas

- **App:** Expo SDK 57 + Expo Router + TypeScript. Um só app; modo motorista a
  acrescentar.
- **Backend:** Supabase (Postgres, RLS, RPCs, Realtime, login por SMS).
- **Regras invioláveis** (testadas):
  1. Aceitação atómica no servidor: a viagem fica com o motorista e o preço
     *daquela* proposta, ou nada muda e é devolvido o motivo.
  2. Aceitação automática usa o mesmo caminho e o mesmo bloqueio — nunca há
     duas atribuições.
  3. O servidor é a fonte de verdade: "motorista a caminho" só com
     `driver_assigned`, mostrando `ride.assignment`; um erro de aceitação nunca
     coexiste com uma viagem atribuída.
- GPS do motorista: enviar a cada 5–10 s, só quando disponível/em viagem.

## 5. Estado actual do código

- Fluxo completo do passageiro a funcionar com um backend simulado
  (`MockRideService`, motoristas fictícios).
- 18 testes Jest a passar; typecheck limpo; bundle Android e web geram sem erros.
- Migração Supabase (`supabase/migrations/`) escrita e testada num Postgres 16
  local, incluindo duas sessões concorrentes a aceitar propostas.
- **Ainda não feito:** ligar o app ao Supabase; preço mínimo validado no
  servidor (TODO na migração); tarifas reais (as de `src/core/pricing.ts` são
  provisórias); mapa e GPS reais; login; modo motorista; lint (`npx expo lint`).

Estrutura principal:

```
src/app/              rotas (Expo Router)
src/core/             lógica pura: tipos, preços, fluxo, contrato do serviço, mock
src/core/__tests__/   testes
src/features/ride/    hook useRideFlow + ecrãs
src/services/         serviço usado pelo app (hoje: mock)
supabase/migrations/  esquema, RLS e RPCs
```

## 6. Próximos passos recomendados

1. Criar um projecto Supabase só para o app, aplicar a migração e implementar
   `RideService` com RPCs + Realtime.
2. Modo motorista mínimo: ficar online, receber pedidos, enviar propostas.
3. Testar com dois telemóveis e alguns motoristas reais.
4. Depois: avaliações, Multicaixa Express, verificação de motoristas.

## 7. Notas sobre o ambiente de desenvolvimento

- No ambiente cloud usado, o proxy bloqueava `api.expo.dev` e `docs.expo.dev`;
  os pacotes foram instalados com `EXPO_OFFLINE=1`. Convém permitir esses
  domínios nas definições de rede do ambiente.
- Comandos: `npm install`, `npm start`, `npm test`, `npm run typecheck`.
