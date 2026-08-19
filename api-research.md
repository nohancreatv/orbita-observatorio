# Dados orbitais — decisão de integração

## Fonte escolhida

A aplicação usará o endpoint público da **Where the ISS at?**:

`https://api.wheretheiss.at/v1/satellites/25544`

Ele retorna posição, altitude, velocidade, visibilidade e data/hora associada ao objeto de catálogo NORAD 25544 (ISS). A documentação informa que não há autenticação no momento e recomenda uma cadência de aproximadamente uma chamada por segundo.

## Campos utilizados

| Campo | Uso na interface |
| --- | --- |
| `latitude` e `longitude` | Posição do marcador no globo e coordenadas exibidas. |
| `altitude` | Telemetria de altitude em quilômetros. |
| `velocity` | Velocidade orbital em quilômetros por hora. |
| `visibility` | Estado de iluminação da ISS: sol, noite ou crepúsculo. |
| `timestamp` | Horário UTC da medição. |
| `footprint` | Contexto de área aproximada abaixo da estação. |

## Previsão local

Após a pessoa autorizar geolocalização no navegador, a página consulta posições futuras suportadas pela mesma API e compara cada coordenada com a cidade do usuário. A interface apresenta a **melhor aproximação nas próximas duas horas** como janela de observação aproximada. Como a visibilidade a olho nu também depende de iluminação solar, nuvens e elevação, o texto da interface comunica isso com transparência e não promete uma observação garantida.

## Referência

- [Where the ISS at? — REST API Documentation](https://wheretheiss.at/w/developer), consultada em 19 de agosto de 2026.
