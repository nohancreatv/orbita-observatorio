# Validação de desempenho — Globo 3D

O teste automatizado `scripts/measure-three-performance.mjs` foi executado com o renderizador React Three Fiber ativo, após 1,2 segundo de aquecimento das texturas. O globo usa renderização sob demanda, um único canvas, quatro marcadores e DPR máximo de 1,25.

| Viewport | Frame médio | Frame p95 | Canvas | Marcadores |
| --- | ---: | ---: | ---: | ---: |
| Desktop, 1280×720 | 41,49 ms | 63,2 ms | 1 | 4 |
| Mobile, 390×844 | 21,46 ms | 41,9 ms | 1 | 4 |

Os valores correspondem ao custo sustentado no navegador automatizado; não incluem a etapa de carregamento inicial das imagens de textura.
