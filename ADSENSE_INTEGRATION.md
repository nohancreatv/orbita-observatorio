# Integração Google AdSense

## Modo ativo: Auto Ads-only

Esta versão usa o **Publisher ID** validado e carrega o script oficial do Google AdSense somente após o visitante aceitar publicidade no banner de privacidade. A monetização ativa é **Auto Ads-only**: a conta do AdSense decide onde servir anúncios conforme sua própria configuração de Auto Ads.

Os três espaços semânticos do layout — lateral esquerda, lateral direita e conteúdo móvel — continuam reservados para evitar deslocamentos de layout, mas **não** solicitam unidades manuais enquanto não forem configurados IDs específicos. Assim, a aplicação não envia `data-ad-slot` vazio ou inventado ao Google.

Para migrar esses inventários para unidades manuais, configure `VITE_ADSENSE_SLOT_SIDEBAR_LEFT`, `VITE_ADSENSE_SLOT_SIDEBAR_RIGHT` e `VITE_ADSENSE_SLOT_FEED_MOBILE` com IDs reais de unidade e mantenha o mesmo fluxo de consentimento. A regressão `scripts/verify-consent-and-ads.mjs` confirma que, no modo atual, os três slots permanecem em `auto` após o aceite e nenhum `<ins class="adsbygoogle">` manual é solicitado.
