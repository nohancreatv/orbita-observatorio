# Validação de integração — 19 de agosto de 2026

- A rota local `orbit.snapshot` retornou coordenadas e os campos de cidade/país em teste HTTP direto.
- A primeira chamada externa da ISS pode exceder oito segundos; o tempo máximo do servidor foi elevado a doze segundos.
- A página pode aparecer no estado inicial durante a captura instantânea, pois as consultas públicas são assíncronas. A cadeia do cliente tRPC foi validada no navegador: a constelação preenche a interface após a janela normal de carregamento.
- A ISS carregou no navegador com telemetria e uma localização terrestre. A seleção do Hubble foi acionada e requer uma breve espera para a consulta dos elementos orbitais públicos da CelesTrak.
- A propagação pública do Hubble preencheu altitude, velocidade, coordenadas e o território abaixo da órbita. A recusa de geolocalização também foi simulada no navegador e apresentou uma mensagem explícita, sem interromper o restante do observatório.
- A telemetria foi simulada como indisponível no navegador. A página preservou a última leitura confiável e exibiu o aviso “O rastreador está indisponível agora. Tente atualizar em instantes.”
- A pré-visualização de falha da NASA exibiu “A janela do cosmos está temporariamente fechada.”, explicou a continuidade do rastreamento orbital e identificou a fonte como indisponível.
- A falha de geocodificação reversa foi simulada após obter coordenadas válidas. A interface preservou a previsão baseada nas coordenadas, mostrou “sua região” e avisou que a cidade não pôde ser identificada.
