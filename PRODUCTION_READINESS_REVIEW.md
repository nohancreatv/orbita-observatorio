# Production Readiness Review — Órbita

**Data:** 20 de agosto de 2026  
**Escopo:** estabilidade, segurança, SEO, acessibilidade, integridade de navegação e regressões críticas.  
**Parecer:** **GO — Sinal Verde para publicação.**

## Decisão

O projeto está aprovado tecnicamente para publicação. A auditoria encontrou problemas reais de qualidade de release — incluindo uma tela em branco no ambiente de desenvolvimento, metadados não entregues por rota no HTML inicial, detalhes internos em uma tela de erro e instrumentação de desenvolvimento no artefato — e todos foram corrigidos e cobertos por validações de regressão.

> Não há vulnerabilidades de produção conhecidas na auditoria de dependências, segredos de servidor no bundle público, telas em branco reproduzíveis, rota pública sem recuperação ou falha bloqueadora de build.

## Correções cirúrgicas aplicadas

| Área | Achado | Correção aplicada | Evidência |
|---|---|---|---|
| Recuperação de interface | O limite global de erro exibiria stacktrace ao visitante. | A recuperação agora tem mensagem em português, botão de recarga e registro técnico somente no console. | Teste força erro controlado, confirma `role="alert"`, botão e ausência de `<pre>`. |
| Estabilidade de desenvolvimento | A configuração do Vite convertida em função era incompatível com a ponte do servidor, fazendo `/src/main.tsx` retornar HTML e gerando tela em branco. | A configuração voltou a ser um objeto resolvido pelo ambiente; a instrumentação continua exclusiva de desenvolvimento. | Entrada voltou a ser servida como módulo TypeScript; página principal, 404 e recuperação renderizadas em captura. |
| Artefato publicado | JSX de desenvolvimento, `data-loc`, caminhos `/home/ubuntu` e ativos do coletor de depuração apareciam no build. | O script de build força `NODE_ENV=production`; plugins e ativos de depuração ficaram fora do artefato publicado. | Varredura do diretório `dist/public` aprovada sem caminhos locais, `jsxDEV`, `data-loc` ou coletor. |
| Inicialização do servidor | Falha de bootstrap era apenas registrada. | O processo agora recebe código de saída não nulo após falha de inicialização. | Tipagem e build aprovados. |
| Consentimento | O banner poderia sobrepor 404 e a tela de recuperação. | O banner é suprimido em rota desconhecida e na falha controlada de desenvolvimento. | Regressão confirma `consentVisible: false` nas duas situações. |
| Privacidade e CSP | Analytics externo era carregado incondicionalmente, embora bloqueado pela CSP e não coordenado com o consentimento. | O script foi removido do documento inicial. | Artefato não contém endpoint, placeholder ou cliente Umami. |
| SEO social e rastreadores | SEO por rota dependia do cliente; sitemap tinha URLs relativas; 404 respondia 200. | Canonical, OpenGraph, Twitter Card, manifesto e sitemap foram ajustados. O servidor injeta SEO por rota no HTML bruto e entrega 404 real com página amigável e `noindex`. | Smoke test de produção confirmou título, canonical, OpenGraph e robots para `/`, `/privacidade` e rota inexistente. |
| Acessibilidade e navegação | A página 404 estava em inglês e desconectada do design; havia risco de links sem destino. | A rota foi localizada, recebeu `main`, `h1`, botão nomeado e rota de retorno. | Regressão verifica uma `main`, um `h1` e ausência de botões sem nome nas rotas públicas. |

## Evidências de validação

| Verificação | Resultado |
|---|---|
| Tipagem | `pnpm check` aprovado. |
| Testes unitários | 9 arquivos e 13 testes aprovados. |
| Dependências de produção | `pnpm audit --prod --audit-level high` sem vulnerabilidades conhecidas. |
| Build | Aprovado com `NODE_ENV=production` explícito. |
| Prontidão de rotas/SEO | Regressão aprovada para rotas públicas, 404, recuperação global, manifest, robots, sitemap e HTML bruto por rota. |
| Consentimento e Auto Ads | Regressão aprovada: anúncio bloqueado antes de consentimento, script inserido após aceite e nenhum slot manual vazio. |
| Alertas no navegador | Regressão aprovada para permissão, ativação e notificação única em condição controlada. |
| Layout e responsividade | Regressão aprovada para trilhos, feed móvel, landmarks e ausência de overflow horizontal. |
| Órbita e resiliência | Transições desktop e móvel, marcadores, telemetria e quatro contingências aprovados. |
| Segurança de artefato | Sem segredo de servidor, caminho local, atributo de depuração, placeholder de ambiente ou analytics externo no bundle público. |

## Riscos residuais não bloqueadores

O runtime Three.js continua com **891,89 kB** (**240,73 kB gzip**) e gera o aviso de chunk grande do Vite. Ele já é diferido até a primeira telemetria e não bloqueia o caminho inicial textual, mas continua sendo a principal oportunidade de desempenho futuro. A remoção adicional exige uma mudança estrutural — build customizado do Three.js ou outra estratégia de renderização — e não deve ser feita como ajuste apressado de release.

O modo de monetização é **Auto Ads-only** após consentimento. Antes de habilitar publicidade personalizada para visitantes do EEE, Reino Unido ou Suíça, o operador deve concluir a configuração de CMP certificada e das exigências de consentimento diretamente na conta Google. Isso é uma obrigação operacional e regulatória, não um defeito técnico bloqueador da aplicação.

## Conclusão

**GO — Sinal Verde.** A base está apta para deploy: compila, entrega rotas recuperáveis, não expõe detalhes internos no bundle ou na tela de erro, valida entradas públicas, aplica cabeçalhos de segurança, apresenta metadados de rastreamento por rota no servidor e passou a matriz de regressão funcional. A publicação desta revisão deve ser acompanhada apenas pelos controles operacionais usuais: monitoramento de erros, configuração da conta de anúncios e acompanhamento do tamanho do runtime 3D.
