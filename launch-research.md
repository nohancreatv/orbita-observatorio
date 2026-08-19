# Base de fontes e operação — Órbita

| Finalidade | Fonte | Decisão de uso |
| --- | --- | --- |
| Elementos orbitais de satélites adicionais | [CelesTrak — GP Data](https://celestrak.org/NORAD/documentation/gp-data-formats.php) | Consultar elementos OMM/JSON por catálogo NORAD para satélites selecionados e propagar suas posições no servidor. |
| Telemetria da ISS | [Where the ISS at? — API](https://wheretheiss.at/w/developer) | Manter a posição da ISS e seus campos de altitude, velocidade e iluminação como fonte especializada. |
| Conteúdo astronômico | [NASA Open APIs](https://api.nasa.gov/) | Usar APOD como curiosidade do dia com título, explicação e crédito; a chave será configurada apenas no servidor. |
| Geocodificação reversa | BigDataCloud Reverse Geocode Client | Traduzir as coordenadas do ponto suborbital para localidade e país, com cache e indicação quando o objeto estiver sobre oceano ou região sem cidade. |
| Políticas de navegador | [MDN — Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) e [MDN — Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation) | Restringir fontes de conteúdo e limitar geolocalização ao próprio site em produção. |

## Decisões de produção

O rastreamento sairá do navegador para rotas de servidor com validação de parâmetros, tempos máximos de resposta, cache e limites de frequência. Assim, a chave da NASA não fica exposta, a dependência de CORS é reduzida e é possível registrar falhas sem coletar localização precisa do visitante.

O lançamento deverá usar HTTPS, domínio configurado, cabeçalhos de segurança no servidor, política de privacidade acessível, termos de uso, atribuição das fontes de dados e uma página de status/limitações. Dados de localização serão consultados somente após ação explícita da pessoa e nunca serão persistidos pela aplicação.

## Extensões de observação selecionadas

| Recurso | Fonte | Uso previsto |
| --- | --- | --- |
| Janela de observação | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Consultar cobertura total de nuvens, visibilidade e condição atual para as coordenadas autorizadas pelo visitante. |
| Linha do tempo espacial | [Launch Library 2](https://ll.thespacedevs.com/docs/) | Exibir uma lista curta de próximos lançamentos com horário, missão, provedor e local de lançamento. |

O Open-Meteo documenta variáveis horárias de cobertura de nuvens e visibilidade por coordenadas. A linha do tempo de lançamentos será tratada como um contexto editorial de baixa frequência, com cache no servidor e indicação clara de quando a fonte estiver indisponível.
