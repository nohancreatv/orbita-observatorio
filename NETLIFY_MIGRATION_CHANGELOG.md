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

Na migração inicial, o projeto Netlify recebeu `NASA_API_KEY` como segredo de função e `VITE_ADSENSE_PUBLISHER_ID` como variável pública de build. A estratégia histórica de armazenamento proprietário foi posteriormente removida; os ativos atuais são versionados em `client/public/assets/`.

> A migração inicial não ativou login externo no domínio Netlify. O site atual mantém as funcionalidades públicas sem autenticação e sem depender de um provedor proprietário.

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

Em uma versão anterior, a tela “O observatório encontrou uma interferência” podia ser causada por uma textura que falhava ao carregar. O problema foi eliminado ao manter as texturas do globo como ativos versionados no próprio repositório e ao remover o redirect de storage proprietário.

A CSP permanece restritiva e autoriza os hosts públicos realmente usados pelas integrações e os ativos locais versionados. A sonda `scripts/debug-recovery-netlify.mjs` executou seis carregamentos de produção sem exceção de página e sem exibir o estado de recuperação. Avisos isolados de provedores externos de anúncios permaneceram fora do escopo da renderização do observatório.


## Correção de independência da plataforma — 2026-08-25

A publicação Netlify agora utiliza somente ativos versionados em `client/public/assets/`, sem redirects para storage proprietário. O runtime de desenvolvimento não usa plugin de plataforma, e os helpers de Forge para storage, mapas, notificações, geração de imagens, dados genéricos e transcrição foram removidos por não participarem do produto público. A validação de release passou a aceitar a origem configurável por `SITE_ORIGIN`, com `BASE_URL` para execução local.

As funcionalidades do observatório continuam baseadas em código próprio, Netlify Functions e APIs públicas configuráveis, incluindo fontes orbitais, NASA, Open-Meteo, BigDataCloud, ArcGIS e The Space Devs. Nenhuma funcionalidade essencial depende de Manus.
