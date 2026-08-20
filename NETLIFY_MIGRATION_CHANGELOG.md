# Migração Netlify — Changelog Técnico

**Data:** 20 de agosto de 2026  
**Projeto Netlify:** `satellite-now`  
**URL de produção:** <https://satellite-now.netlify.app>

## Resultado

O observatório **Órbita** foi adaptado para execução no Netlify sem transformar as consultas orbitais em chamadas diretas do navegador. O frontend permanece estático e a camada pública tRPC é servida por uma Netlify Function que encapsula a aplicação Express existente. O endpoint de catálogo e de snapshots orbitais respondeu `200` em produção, com os quatro objetos sincronizados.

| Área | Alteração aplicada | Resultado validado |
|---|---|---|
| Servidor | Extração do núcleo compartilhado para `createApiApp()` | Servidor local e função usam os mesmos middlewares, tRPC, OAuth e proxy de armazenamento. |
| Função | Adaptador `serverless-http` em `netlify/functions/api.ts` | Rotas públicas permanecem em `/api/trpc/*`. |
| Build | `netlify.toml` com função, redirects, cabeçalhos e 404 | Build offline do Netlify concluída sem falhas. |
| Dependências | Express é empacotado com os módulos transitivos; `satellite.js` foi fixado em versão CommonJS compatível | Eliminados os erros 502 de `body-parser` e de export ESM ausente. |
| Segurança | CSP, HSTS, Permissions Policy e `X-Content-Type-Options` definidos na borda | Cabeçalhos confirmados na URL de produção. |
| Resiliência NASA | `space.story` devolve `null` de forma controlada quando a fonte não responde | A interface mostra contingência editorial, sem erro tRPC exposto. |

## Validação de produção

A API publicada retornou o catálogo e snapshots da ISS, Hubble, Tiangong e NOAA 19 com status HTTP `200`. A página carregou quatro objetos, globo e telemetria reais. A rota desconhecida retornou `404`, e a chamada da NASA respondeu `200` com conteúdo `null` quando indisponível, preservando a experiência do observatório.

Em ambiente local, foram aprovados a checagem TypeScript, **12 arquivos / 18 testes Vitest**, contingências de fonte externa, transições do globo em desktop e mobile, metadados de release, consentimento de anúncios e layout publicitário.

## Configuração externa

O projeto Netlify recebeu `NASA_API_KEY` como segredo de função e `VITE_ADSENSE_PUBLISHER_ID` como variável pública de build. Os ativos do globo continuam referenciados por rewrite ao armazenamento da publicação Manus, portanto nenhum segredo de armazenamento é entregue ao frontend.

> O login Manus não foi ativado no domínio Netlify porque suas variáveis de OAuth e a URL de callback não foram configuradas nesse provedor. Isso não afeta as funcionalidades públicas do observatório, que são a superfície atualmente publicada.

## Arquivos principais

| Arquivo | Função |
|---|---|
| `server/_core/app.ts` | Núcleo Express reaproveitável pela função e pelo servidor local. |
| `netlify/functions/api.ts` | Entrada serverless para API e tRPC. |
| `netlify.toml` | Build, função, rewrites, headers e política de 404. |
| `server/_core/index.ts` | Bootstrap local simplificado para reutilizar o núcleo HTTP. |
| `server/orbitService.ts` | Guarda de tipo da propagação compatível com a biblioteca orbital publicada. |
| `scripts/verify-orbit-transitions.mjs` | Captura atômica da janela de transição de 500 ms, eliminando condição de corrida E2E. |

## Correção da recuperação recorrente

A tela “O observatório encontrou uma interferência” não era causada pela telemetria. A política `img-src` do Netlify permitia a URL interna `/manus-storage`, mas bloqueava o host CloudFront para o qual essa URL redirecionava. Quando a textura diurna da Terra era bloqueada, o `TextureLoader` do Three.js lançava uma exceção e a fronteira de erro assumia a tela inteira.

A CSP foi corrigida para autorizar apenas `https://d36hbw14aib5lz.cloudfront.net` em `img-src`, que é o host efetivo das texturas já vinculadas ao projeto. A sonda `scripts/debug-recovery-netlify.mjs` executou seis carregamentos de produção sem exceção de página e sem exibir o estado de recuperação. Avisos isolados de provedores externos de anúncios permaneceram fora do escopo da renderização do observatório.
