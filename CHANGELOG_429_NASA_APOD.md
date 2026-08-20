# Changelog técnico — resiliência da NASA APOD

**Escopo:** correção de erro externo `429` observado na procedure pública `space.story`.

## Diagnóstico

A falha vinha da consulta à NASA APOD em `getSpaceStory()`. Quando a origem respondia com HTTP `429`, a exceção atravessava a procedure tRPC e chegava ao navegador como `TRPCClientError`. A telemetria orbital não era a origem do incidente.

## Correção aplicada

| Camada | Mudança | Resultado esperado |
|---|---|---|
| Cache compartilhado | `withCache()` passou a manter uma janela de valor expirado utilizável. | Uma indisponibilidade temporária pode exibir o último conteúdo seguro em vez de propagar falha. |
| Deduplicação | Um mapa `inFlight` reúne chamadas simultâneas pela mesma chave de cache. | Recargas e abas concorrentes não multiplicam a mesma consulta externa. |
| Backoff | A APOD entra em pausa de 15 minutos depois de um `429`. | O servidor deixa de insistir na origem limitada durante a janela de recuperação. |
| Interface | `null` da procedure é tratado como contingência editorial. | O cartão informa que a janela do cosmos está fechada, sem tela branca ou erro de consulta ao visitante. |
| Regressão | Foi incluído teste unitário específico e cenário E2E de conteúdo NASA vazio. | O contrato resiliente permanece coberto em mudanças futuras. |

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `server/orbitService.ts` | Cache com fallback expirado, deduplicação em voo, pausa de 429 e retorno não disruptivo de `getSpaceStory()`. |
| `server/orbitService.rateLimit.test.ts` | Regressão que verifica conversão de 429 em `null` e bloqueio de nova consulta durante a pausa. |
| `client/src/pages/Home.tsx` | Estado de contingência explícito para conteúdo NASA ausente. |
| `scripts/verify-three-contingencies.mjs` | Cenário E2E adicional para API NASA sem conteúdo. |
| `scripts/verify-orbit-transitions.mjs` | Sondagem E2E estabilizada para observar o commit React da transição 3D de 500 ms em WebGL headless. |

## Evidências de validação

| Verificação | Resultado |
|---|---|
| `pnpm check` | Aprovado. |
| `pnpm test` | Aprovado: 12 arquivos e 18 testes. |
| Contingências 3D | Aprovadas: telemetria, NASA por erro, NASA sem conteúdo, geolocalização negada e geocodificação indisponível. |
| Transições orbitais | Aprovadas em desktop e celular para ISS, Hubble, Tiangong e NOAA 19. |
| Release, consentimento e anúncios | Aprovados: rotas, SEO/404, recuperação de erro, bloqueio pré-consentimento e layout responsivo. |

> O erro 429 deixa de ser exposto ao visitante. Quando a fonte não puder atender, o observatório mantém as leituras orbitais e exibe uma mensagem de contingência restrita ao cartão de curiosidade.
