# Validação pós-correção dos marcadores 3D

O teste automatizado `scripts/verify-three-labels.mjs` foi executado em desktop (1280×720) e celular (390×844), percorrendo **ISS, Hubble, Tiangong e NOAA 19**.

| Viewport | Objetos focados | Marcadores no canvas | Marcador ativo dentro do globo | Colisões frontais | Rótulos HTML no canvas |
| --- | --- | ---: | --- | --- | ---: |
| Desktop | ISS, Hubble, Tiangong, NOAA 19 | 4 em cada foco | Sim em todos | Nenhuma (`closePairs: []`) | 0 |
| Mobile | ISS, Hubble, Tiangong, NOAA 19 | 4 em cada foco | Sim em todos | Nenhuma (`closePairs: []`) | 0 |

Cada troca de foco também foi confirmada pelo painel externo, que apresentou o nome, as coordenadas e o local suborbital do objeto selecionado. A remoção dos rótulos flutuantes evita cortes nas bordas do canvas.
