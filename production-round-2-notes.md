# Diagnóstico visual — rodada 2

- Em **1280 px**, a composição principal e a faixa de telemetria aparecem íntegra no fluxo completo; não houve recorte do valor de velocidade.
- A captura fornecida mostra um corte no limite lateral de um item de telemetria. Como a faixa muda sua grade no breakpoint de **1050 px**, a próxima reprodução deve focalizar a largura intermediária e os limites de coluna, especialmente entre 761 px e 1050 px.
- A inspeção também confirmou que o globo, a telemetria e os módulos abaixo da dobra são renderizados com dados reais neste viewport; o diagnóstico seguirá sem alterar o conteúdo orbital.

No viewport de **1024 px**, a reprodução confirmou que a colocação automática da CSS Grid deixou o item de velocidade competir com a coluna do botão de atualização. A correção fixa explicitamente as quatro células de telemetria e reserva a terceira coluna para atualização em duas linhas. A nova inspeção em 1024 px mostrou o cartão sem conteúdo lateral cortado.

O banner de consentimento foi inspecionado em **1024 px** e **390 px**. Em ambos os tamanhos, o texto, a política vinculada e as três ações de escolha permanecem legíveis; em tela pequena, as ações são reorganizadas em duas linhas para manter a largura de toque adequada. O banner é removido assim que uma decisão é salva.
