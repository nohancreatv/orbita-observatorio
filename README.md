# Órbita — Observatório orbital em tempo real

O **Órbita** é uma experiência editorial para acompanhar a Estação Espacial Internacional e outros objetos orbitais em um globo 3D. A aplicação combina telemetria orbital, geocodificação do ponto suborbital, previsão de passagem visível, condições locais de observação, agenda de lançamentos e uma curiosidade espacial diária.

> A aplicação pública está em [satellite-now.netlify.app](https://satellite-now.netlify.app). Este repositório privado contém a aplicação e sua infraestrutura de publicação.

## Recursos

O observatório acompanha ISS, Hubble, Tiangong e NOAA 19 com propagação orbital no servidor. O globo usa React Three Fiber, mapas de dia e noite, nuvens, atmosfera e transições de foco em 500 ms. A página também contextualiza o ponto terrestre sob cada objeto, permite geolocalização opcional e apresenta previsão de passagem, condições de observação e agenda espacial.

As integrações externas incluem dados orbitais públicos, NASA APOD, geocodificação e clima. A curiosidade NASA possui cache, deduplicação e fallback não disruptivo para que um limite de fonte externa não interrompa a telemetria. A camada de segurança inclui cookies de sessão, CSP, HSTS, rate limiting, API sem cache e validação de entrada.

## Arquitetura

| Camada       | Localização                |
| ------------ | -------------------------- |
| Frontend     | `client/`                  |
| API tRPC     | `server/`                  |
| Núcleo HTTP  | `server/_core/app.ts`      |
| Função       | `netlify/functions/api.ts` |
| Deploy       | `netlify.toml`             |
| Verificações | `scripts/`                 |

O frontend é estático e a camada pública tRPC é atendida por uma Netlify Function que encapsula a aplicação Express. As rotas `/api/trpc/*` são encaminhadas para essa função. Os ativos do globo em `/manus-storage/*` usam um redirect controlado para o armazenamento gerenciado, sem expor uma chave ao navegador.

## Pré-requisitos

Use **Node.js 22** e **pnpm 10**. O repositório mantém `pnpm-lock.yaml`; por isso, instalações reproduzíveis devem usar `--frozen-lockfile`.

```bash
node --version
corepack enable
pnpm --version
```

## Execução local

Clone o repositório, instale as dependências e inicie o ambiente de desenvolvimento.

```bash
git clone https://github.com/nohancreatv/orbita-observatorio.git
cd orbita-observatorio
pnpm install --frozen-lockfile
pnpm dev
```

O servidor Express e o Vite ficam disponíveis na porta livre, normalmente `http://localhost:3000`. Para testar exatamente os redirects e a função usados em produção, inicie o ambiente Netlify local.

```bash
pnpm exec netlify dev
```

O proxy do Netlify atende normalmente em `http://localhost:8888` e encaminha API e funções conforme `netlify.toml`.

## Variáveis de ambiente

Não envie valores de produção para o repositório e não versione arquivos `.env`. `NASA_API_KEY` é usada apenas pela função Netlify e melhora a consulta APOD; se ausente, o cartão NASA mostra contingência sem interromper a telemetria. `VITE_ADSENSE_PUBLISHER_ID` é um Publisher ID público no formato `ca-pub-...`; sem ele, o Auto Ads não é carregado.

Uma implantação externa com login Manus persistente também requer `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` e `OWNER_OPEN_ID`. Antes de ativar esse login fora do ambiente gerenciado, registre o domínio de callback OAuth autorizado.

Na automação do GitHub Actions, `NETLIFY_AUTH_TOKEN` é o único valor que precisa ser cadastrado no repositório. Ele é um segredo e nunca deve usar o prefixo `VITE_`. O identificador não secreto do projeto Netlify e o Publisher ID público do AdSense ficam definidos no workflow para evitar variáveis de repositório adicionais.

## Verificação de qualidade

Antes de enviar mudanças para `main`, execute a checagem de tipos, os testes e a build equivalente à do Netlify.

```bash
pnpm check
pnpm test
pnpm run build:netlify
pnpm exec netlify build --offline
```

Para verificar especificamente contingências e interações orbitais, execute `node scripts/verify-three-contingencies.mjs`, `node scripts/verify-orbit-transitions.mjs` e `E2E_MOBILE=1 node scripts/verify-orbit-transitions.mjs`.

## Deploy automático com GitHub Actions

O workflow [`.github/workflows/netlify-production.yml`](.github/workflows/netlify-production.yml) é acionado em cada push para `main` e manualmente por `workflow_dispatch`. Ele executa tipagem, testes e build Netlify antes do deploy. O job de produção só inicia se a validação tiver êxito.

Para ativar o deploy automático, abra **Settings → Secrets and variables → Actions** no repositório GitHub. Em **Secrets**, crie `NETLIFY_AUTH_TOKEN` com um Personal Access Token do Netlify.

O token pode ser gerado no Netlify em **User settings → Applications → Personal access tokens**. O CLI usa `NETLIFY_AUTH_TOKEN` para autenticação e `NETLIFY_SITE_ID` para escolher o projeto publicado. [1]

Depois de salvar os dois valores, faça um push na `main` ou abra **Actions → Validar e publicar no Netlify → Run workflow**. O workflow publica a mesma configuração de `netlify.toml`, incluindo a função Express/tRPC.

## Segurança e operação

Dependências, saídas de build, `.netlify` e arquivos `.env*` são ignorados pelo Git. O `netlify.toml` mantém CSP, HSTS, políticas de permissão, proteção de iframe e redirects de API. A política de imagens autoriza somente o host CloudFront necessário para as texturas do globo, evitando uma falha de carregamento 3D que acionaria a fronteira de erro.

## Referências

[1] [Netlify CLI: autenticação, variáveis de CI e deploys](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
