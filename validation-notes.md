# Validação de integração — 19 de agosto de 2026

- A rota local `orbit.snapshot` retornou coordenadas e os campos de cidade/país em teste HTTP direto.
- A primeira chamada externa da ISS pode exceder oito segundos; o tempo máximo do servidor foi elevado a doze segundos.
- A página pode aparecer no estado inicial durante a captura instantânea, pois as consultas públicas são assíncronas. A cadeia do cliente tRPC foi validada no navegador: a constelação preenche a interface após a janela normal de carregamento.
- A ISS carregou no navegador com telemetria e uma localização terrestre. A seleção do Hubble foi acionada e requer uma breve espera para a consulta dos elementos orbitais públicos da CelesTrak.
- A propagação pública do Hubble preencheu altitude, velocidade, coordenadas e o território abaixo da órbita. A recusa de geolocalização também foi simulada no navegador e apresentou uma mensagem explícita, sem interromper o restante do observatório.
- A telemetria foi simulada como indisponível no navegador. A página preservou a última leitura confiável e exibiu o aviso “O rastreador está indisponível agora. Tente atualizar em instantes.”
- A pré-visualização de falha da NASA exibiu “A janela do cosmos está temporariamente fechada.”, explicou a continuidade do rastreamento orbital e identificou a fonte como indisponível.
- A falha de geocodificação reversa foi simulada após obter coordenadas válidas. A interface preservou a previsão baseada nas coordenadas, mostrou “sua região” e avisou que a cidade não pôde ser identificada.

## Globo multiobjetos

A página carregou quatro objetos simultaneamente, com a ISS em foco, imagem de referência, telemetria e ponto suborbital. A sessão do navegador conectado apresentou um erro transitório de extensão antes da interação do Hubble; a transição será validada também por inspeção do estado renderizado e pelas verificações da interface local.

A renderização responsiva confirmou os quatro marcadores simultâneos, o alvo ativo em laranja, o cartão de referência do objeto e as seções de condições do céu e agenda espacial. Uma segunda tentativa de interação na sessão conectada voltou a exceder o tempo da extensão; as rotas agregadas e os componentes foram validados por testes e consultas HTTP locais.

O teste executável `server/orbitVisual.test.ts` confirmou a centralização do Hubble, a classe de marcador ativo e uma rotação distinta para mudanças de longitude. A suíte completa passou com oito testes.

O teste ponta a ponta isolado concluiu com sucesso: a seleção do Hubble alterou o rótulo do marcador ativo, o título e a imagem do cartão, além da variável de rotação do globo de `62.29deg` para `-129.11deg`.

A prova ponta a ponta ampliada confirmou o fluxo completo em uma única interação: Hubble ficou ativo, o globo alterou sua rotação, a imagem e o título do cartão foram atualizados, e a telemetria recebeu altitude de 469,3 km, velocidade de 27.493 km/h e a localização “Mar das Filipinas”.

O refinamento 3D foi validado no navegador automatizado: a troca de foco do Hubble atualizou o painel de telemetria e o local suborbital, enquanto a duração computada da rotação do globo foi `0.5s`.

A captura móvel posterior ao refinamento confirmou a leitura do globo com continentes, nuvens, foco laranja, cartão do objeto e retrato suborbital sem quebra de hierarquia ou sobreposição crítica.

## Renderizador 3D React Three Fiber

O globo CSS foi substituído por um canvas React Three Fiber com textura diurna, emissivo noturno, camada de nuvens, atmosfera Fresnel e quatro marcadores geodésicos. A validação E2E desktop e móvel confirmou a seleção da ISS/Hubble, atualização do foco, telemetria e local suborbital. A preferência `prefers-reduced-motion` foi exercitada e reduz o canvas a renderização sob demanda.

Os quatro estados de contingência foram revalidados com o canvas ativo: telemetria indisponível, NASA APOD indisponível, geolocalização negada e geocodificação indisponível. A medição sustentada após aquecimento de texturas registrou 41,49 ms médios / 63,2 ms p95 no viewport desktop e 21,46 ms médios / 41,9 ms p95 no móvel, cada um com um único canvas e quatro marcadores.

O recorte de rótulos foi corrigido: somente o objeto em foco recebe rótulo no canvas, e o teste em viewport 482×479 confirmou que “Hubble” permaneceu integralmente dentro da área útil do globo.

A correção definitiva substituiu rótulos HTML flutuantes por identificação no painel externo de foco. A validação percorreu ISS, Hubble, Tiangong e NOAA 19 em desktop e celular: o canvas teve zero rótulos suscetíveis a recorte, enquanto o painel externo exibiu corretamente o nome, a coordenada e o local de cada objeto.

As capturas pós-correção confirmam que os quatro marcadores permanecem como pings compactos dentro da esfera, sem texto atravessando a borda. Em desktop, a leitura foi validada com NOAA 19 em foco; em celular, o seletor, o status e a área do globo permanecem legíveis, sem sobreposição de rótulos no canvas.

### Marcadores pós-correção — validação E2E

O teste geométrico percorreu ISS, Hubble, Tiangong e NOAA 19 nos viewports desktop e mobile. Em todos os oito focos, a asserção encontrou quatro marcadores no canvas, o marcador ativo dentro da área do globo e nenhuma colisão projetada entre marcadores frontais (`closePairs: []`). O canvas continuou sem rótulos HTML (`canvasLabelCount: 0`), e o painel externo confirmou a identificação do objeto e seu local suborbital.

## Validação consolidada do globo 3D

| Viewport | Interação validada | Evidência |
| --- | --- | --- |
| Desktop, 1280×720 | Troca ISS → Hubble; marcador, imagem, telemetria, local e rotação atualizados. | Teste E2E isolado e captura de desktop. |
| Mobile, 390×844 | Troca ISS → Hubble; painel geográfico legível e duração computada de rotação `0.5s`. | Teste E2E móvel, com artefato `hubble-focus-e2e-mobile.png`. |
