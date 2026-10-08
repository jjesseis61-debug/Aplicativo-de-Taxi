# Aplicativo de Taxi

App de passageiro (Expo / React Native, TypeScript) com **preço negociado**: o
passageiro propõe um preço, os motoristas aceitam ou fazem contraproposta, e o
passageiro escolhe.

## Fluxo

```
Rota → Preço (categoria, +/−, aceitação automática) → Confirmar partida
     → À procura (propostas, actualizar preço) → Motorista a caminho
     → Cancelar (motivo) → Cancelada / Expirada → Nova viagem
```

O fluxo é uma máquina de estados pura em `src/core/rideFlow.ts`; o ecrã de cada
fase está em `src/features/ride/screens/`.

## Regras que o esqueleto garante

Vieram da análise de um app concorrente, onde o passageiro aceitou a proposta
de um motorista a 5 200 AOA e acabou com outro motorista a 4 500 AOA, com um
"Ocorreu um erro" por cima do ecrã "Motorista a caminho".

1. **Aceitação atómica no servidor.** Ou a viagem fica com o motorista e o
   preço *daquela* proposta, ou nada muda e é devolvido o motivo.
2. **A aceitação automática usa o mesmo caminho** e o mesmo bloqueio — nunca há
   duas atribuições para a mesma viagem.
3. **O servidor é a fonte de verdade.** O ecrã "a caminho" só aparece com um
   snapshot `driver_assigned` e mostra `ride.assignment`. Um erro de aceitação
   nunca aparece ao mesmo tempo que uma viagem atribuída.
4. Preço mínimo validado no servidor; português de Angola/Portugal consistente.

## Estrutura

```
src/app/                 rotas (Expo Router)
src/core/                lógica pura, sem React: tipos, preços, fluxo, serviço
src/core/__tests__/      testes (Jest)
src/features/ride/       hook useRideFlow + ecrãs
src/services/            instância do serviço usada pelo app (hoje: mock)
src/ui/                  tema e componentes base
supabase/migrations/     esquema e RPCs do backend (Postgres/Supabase)
```

`MockRideService` simula o backend em memória, incluindo motoristas fictícios
que enviam propostas. `supabase/migrations/` tem o equivalente real: tabelas
`rides`/`offers`/`drivers`, RLS só de leitura e as RPCs `request_ride`,
`submit_offer`, `accept_offer`, `reject_offer`, `update_ride_price` e
`cancel_ride`, com `accept_offer` e `submit_offer` a bloquear a linha da viagem.

## Comandos

```bash
npm install
npm start           # Expo dev server (Expo Go, Android, iOS ou web)
npm test            # testes do núcleo
npm run typecheck
```

## Próximos passos

- Ligar `RideService` ao Supabase (RPCs + Realtime) e trocar o mock em `src/services/rideService.ts`.
- Calcular preço recomendado/mínimo no servidor (hoje em `src/core/pricing.ts`, com tarifas provisórias).
- Mapa e geolocalização reais (substituir `MapPlaceholder`), pesquisa de endereços.
- Autenticação, app/modo motorista, histórico e avaliações.
