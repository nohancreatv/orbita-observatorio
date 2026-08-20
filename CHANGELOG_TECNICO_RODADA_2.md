# Changelog Técnico — Rodada 2

**Projeto:** Órbita (`iss-overhead`)  
**Escopo:** consentimento de publicidade, Google AdSense, alertas opt-in em sessão, desempenho 3D e correção responsiva.  
**Status:** validado em desenvolvimento e incluído no checkpoint desta rodada.

## Resumo da arquitetura

O observatório agora começa com publicidade **negada por padrão**. A decisão do visitante é persistida somente no armazenamento local do navegador; quando a publicidade é aceita, a aplicação atualiza o Consent Mode e, então, injeta o script oficial do AdSense. O Publisher ID foi validado e não foi exposto no código-fonte. O modo configurado é **Auto Ads-only**: o Google pode posicionar anúncios conforme a configuração da conta, enquanto os três espaços editoriais continuam reservados e não fazem requisições manuais sem IDs de unidade reais.

> Para tráfego personalizado no EEE, Reino Unido e Suíça, a configuração da conta ainda deve usar uma CMP certificada pelo Google e integrada ao IAB TCF. O banner local implementa a escolha técnica e bloqueia o carregamento prévio; ele não substitui a configuração regulatória da conta do publisher.[1] [2]

## Achados e soluções

| Achado | Solução aplicada | Evidência |
|---|---|---|
| O cartão de velocidade era cortado no breakpoint intermediário. | A grade de telemetria passou a declarar explicitamente as quatro células e a coluna exclusiva do botão de atualização em até 1050 px. | Reprodução e correção verificadas em 1024 px. |
| Não havia consentimento persistente nem barreira para anúncios. | Criados `ConsentProvider` e `CookieConsentBanner`; o estado padrão é negado e a escolha pode ser revogada por “cookies” no rodapé. | Regressão confirma ausência do script antes do aceite e estado concedido depois. |
| O AdSense exigia proteção CSP e carregamento condicionado. | CSP limitada aos domínios necessários do Google; o script oficial só é inserido depois do consentimento. | Teste de cabeçalhos e teste E2E aprovados. |
| Faltavam IDs de unidade para os três trilhos manuais. | A versão publicada opera em **Auto Ads-only**. Os espaços mantêm altura reservada, porém nenhum `<ins>` manual é criado sem ID válido. | `ADSENSE_INTEGRATION.md` e regressão confirmam três slots no modo `auto` e zero requisições manuais. |
| Alertas precisavam ser opcionais e não operar com navegador fechado. | O controle pede permissão somente por clique, é armazenado por sessão e emite uma notificação única até 10 minutos antes de uma aproximação favorável. | Simulação E2E valida geolocalização, permissão concedida, ativação e exatamente uma notificação. |
| O runtime 3D bloqueava o caminho de carga do componente principal. | O globo só é importado após a primeira telemetria; Three.js e React Three Fiber foram isolados em `three-runtime`, e a geometria recebeu redução de segmentos e anisotropia. | Build separa um carregador de globo de 11,69 kB gzip 2,74 kB do runtime 3D diferido. |
| Um teste de rotação dependia de imprecisão de ponto flutuante. | A rotação foi normalizada para seis casas antes de gerar a unidade CSS. | A suíte do cliente passou a executar junto à suíte de servidor. |

## Alertas de passagem

O usuário escolheu a modalidade **A**: alertas no navegador enquanto o observatório permanece aberto. A implementação não cria serviço em segundo plano, não mantém coordenadas no banco e não usa temporizadores no servidor. A previsão de passagem é reavaliada pelo fluxo de dados já existente; a regra só dispara com permissão concedida, aproximação abaixo de 2.500 km, janela de até dez minutos e uma chave de sessão ainda não emitida.

As notificações do sistema exigem HTTPS e permissão concedida em interação explícita; por isso o pedido ocorre no botão de alerta, não na carga da página.[3] Em navegadores incompatíveis, a previsão continua acessível na própria página.

## Medição de desempenho

| Artefato | Antes | Depois |
|---|---:|---:|
| Entrada principal | 709,07 kB / 202,41 kB gzip | 322,76 kB / 84,10 kB gzip |
| Componente do globo | 1.017,90 kB / 275,03 kB gzip | 11,69 kB / 2,74 kB gzip |
| Runtime Three.js diferido | incluso no chunk do globo | 1.005,14 kB / 272,62 kB gzip |

O runtime Three.js ainda gera aviso de chunk grande, mantido propositalmente visível. Ele agora é baixado após a primeira telemetria, não no caminho inicial de texto e consentimento. Uma redução adicional relevante exigirá adotar build customizado do Three.js ou trocar a estratégia de renderização; não foi feito corte artificial que prejudicasse continentes, nuvens, atmosfera ou interação.

## Validações concluídas

| Verificação | Resultado |
|---|---|
| `pnpm check` | Aprovado. |
| `pnpm test` | 9 arquivos e 13 testes aprovados. |
| Auditoria de produção | Sem vulnerabilidades conhecidas. |
| Consentimento e Auto Ads | Script bloqueado antes do aceite; script inserido após aceite; três slots em modo `auto`; zero slots manuais sem ID. |
| Alertas no navegador | Permissão, ativação e emissão única aprovadas em regressão controlada. |
| Telemetria responsiva | Sem recorte em 1024 px após correção da grade. |
| Globo e contingências | Transições desktop e móvel, marcadores e quatro contingências aprovados. |
| Build | Aprovado; divisão de `three-runtime` confirmada. |

## Arquivos principais modificados

| Área | Arquivos |
|---|---|
| Consentimento e Ads | `client/src/contexts/ConsentContext.tsx`, `client/src/components/CookieConsentBanner.tsx`, `client/src/components/AdSlot.tsx`, `server/security.ts`, `ADSENSE_INTEGRATION.md` |
| Alertas | `client/src/pages/Home.tsx`, `client/src/lib/passAlerts.ts`, `client/src/lib/passAlerts.test.ts`, `scripts/verify-browser-pass-alert.mjs` |
| Desempenho 3D | `client/src/components/EarthGlobe.tsx`, `vite.config.ts`, `performance-round-2.md` |
| Correções e validação | `client/src/index.css`, `client/src/lib/orbitVisual.ts`, `client/src/lib/orbitVisual.test.ts`, `scripts/verify-consent-and-ads.mjs`, `vitest.config.ts` |
| Transparência | `client/src/pages/Privacy.tsx`, `production-round-2-notes.md`, `todo.md` |

## Referências

[1]: https://support.google.com/adsense/answer/13554116 "Google AdSense — Consent Management Platform requirements"
[2]: https://developers.google.com/tag-platform/security/guides/consent "Google Tag Platform — Consent Mode"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static "MDN — Notification.requestPermission()"
