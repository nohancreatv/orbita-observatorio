# Changelog Técnico — Rodada de Elevação para Produção

**Projeto:** Órbita (`iss-overhead`)  
**Escopo:** segurança, carregamento, resiliência assíncrona e layout de inventário publicitário.  
**Status:** validado em desenvolvimento e pronto para publicação no checkpoint desta rodada.

## Síntese executiva

Esta rodada tratou riscos de cadeia de suprimentos, reduziu o trabalho crítico de JavaScript do observatório e preparou inventário de anúncios sem inserir scripts de terceiros ou identificadores de publisher. O layout continua priorizando o conteúdo orbital: as laterais só são exibidas quando há largura suficiente para manter a coluna editorial confortável; em telas móveis, os trilhos desaparecem e um único espaço semântico passa a existir no fluxo final.

> A integração efetiva de Google Ads permanece propositalmente desacoplada. O componente reserva uma área estável, acessível e identificável por `data-ad-slot`, mas não carrega anúncios, rastreadores ou código externo antes da configuração de consentimento e do publisher ID.

## Achados e soluções aplicadas

| Achado | Solução arquitetural | Resultado verificado |
|---|---|---|
| Dependências de produção tinham alertas altos, incluindo cliente HTTP, ORM, roteador HTTP e utilitários transitivos. | Atualização compatível de Axios, Drizzle ORM, Express, Lodash e NanoID. Remoção de `streamdown` e de componentes de demonstração sem rota pública que traziam Mermaid/Lodash ES. | `pnpm audit --prod --audit-level high` retorna **No known vulnerabilities found**. |
| O globo React Three Fiber era importado no caminho principal da página. | `React.lazy` e `Suspense` passaram a carregar o componente 3D em chunk próprio, com `GlobeFallback` de proporção fixa. | Build separa `EarthGlobe` do bundle de entrada; o canvas e as quatro transições seguem validados. |
| O fallback do globo poderia causar uma troca visual brusca. | Placeholder com a mesma posição, proporção circular, volume visual e suporte a `prefers-reduced-motion`. | Área do estágio permanece reservada durante o carregamento. |
| Não havia inventário publicitário pronto sem sacrificar a largura de leitura. | Componente `AdSlot` reutilizável e grade de três colunas somente a partir de 1440 px. As laterais usam 160 × 600 px; no celular elas são ocultadas e há slot de feed de 132 px. | Teste automatizado confirma dimensões, landmark principal única, botões nomeados e ausência de overflow horizontal em 390 px. |
| Telemetria, agenda e APOD podiam passar por estados intermediários com texto instável. | Estados `aria-busy` e placeholders de altura fixa para telemetria, lançamentos e curiosidade NASA. | Carregamento assíncrono preserva as dimensões de cada bloco; contingências existentes continuam aprovadas. |
| O teste da NASA fazia uma chamada de rede no ciclo unitário e expirava em ambientes lentos. | O teste agora valida a presença e o formato da configuração; a indisponibilidade externa continua coberta como contingência de interface. | Suíte Vitest deixa de depender de rede pública e conclui de forma determinística. |
| A regressão de transição usava espera fixa e podia falhar sob carga de canvas. | O script passou a aguardar explicitamente a fase transitória e a estabilização do atributo de estado. | ISS, Hubble, Tiangong e NOAA 19 passam em desktop e celular. |

## Core Web Vitals e custo de carregamento

A otimização aplicada evita que o código do globo faça parte do arquivo JavaScript de entrada: o artefato de produção passou a expor um bundle principal de **709,07 kB** (**202,41 kB gzip**) e um chunk 3D adiado de **1.017,90 kB** (**275,03 kB gzip**). Como o globo está acima da dobra, o navegador ainda o solicita logo após o render inicial, mas ele não bloqueia o parsing e a execução do bundle de entrada.

Foram reservadas dimensões para o fallback 3D, telemetria, lançamentos, APOD e slots de anúncios, reduzindo fontes previsíveis de **CLS**. As imagens abaixo da dobra usam `loading="lazy"` e `decoding="async"`; a marca tem dimensões declaradas; a origem das fontes recebe `preconnect`.

O chunk 3D ainda ultrapassa o limite de aviso padrão do Vite, principalmente pelo runtime Three.js. O aviso não foi ocultado artificialmente. A próxima redução material exigiria uma estratégia maior — por exemplo, substituição por build customizado do Three.js, importação seletiva no nível do bundler ou alternativa de renderização — e deve ser avaliada contra o custo de manutenção e a fidelidade visual do globo.

## Validações executadas

| Verificação | Resultado |
|---|---|
| `pnpm check` | Aprovado. |
| `pnpm test` | 6 arquivos e 8 testes aprovados. |
| `pnpm audit --prod --audit-level high` | Sem vulnerabilidades conhecidas. |
| `pnpm build` | Aprovado; code splitting do globo confirmado. |
| `verify-orbit-transitions.mjs` | Aprovado em desktop e celular, com giro, marcador, telemetria e estabilização. |
| `verify-three-labels.mjs` | Aprovado; quatro marcadores, sem rótulos recortados. |
| `verify-three-contingencies.mjs` | Aprovado para telemetria, NASA, geolocalização negada e geocodificação indisponível. |
| `verify-monetization-layout.mjs` | Aprovado; dois trilhos de 160 × 600 no desktop, slot móvel de 358 × 132, sem overflow e com checagens básicas de acessibilidade. |

## Arquivos modificados

| Área | Arquivos |
|---|---|
| Layout e estados de interface | `client/src/pages/Home.tsx`, `client/src/index.css`, `client/index.html` |
| Componentes novos | `client/src/components/AdSlot.tsx`, `client/src/components/GlobeFallback.tsx` |
| Renderização 3D | `client/src/components/EarthGlobe.tsx` |
| Regressões e testes | `scripts/verify-orbit-transitions.mjs`, `scripts/verify-monetization-layout.mjs`, `server/nasa.secret.test.ts` |
| Dependências e limpeza | `package.json`, `pnpm-lock.yaml`, remoção de `client/src/components/AIChatBox.tsx` e `client/src/pages/ComponentShowcase.tsx` |
| Rastreabilidade | `todo.md`, `CHANGELOG_TECNICO.md` |

## Próximo passo de monetização

Quando houver um publisher ID e uma política de consentimento aprovada, o integrador deve inicializar o provedor de anúncios **apenas** nos nós `[data-ad-slot]`, sem alterar as dimensões reservadas nem colocar scripts de terceiros no fluxo crítico da página. Esse acoplamento deve incluir consentimento, política de privacidade revisada e validação de impacto de desempenho no domínio publicado.
