# Validação de transições orbitais

O teste ponta a ponta `scripts/verify-orbit-transitions.mjs` foi executado em **desktop (1280×720)** e **celular (390×844)** com o canvas React Three Fiber ativo.

| Sequência | Mudança de longitude | Marcador ativo | Telemetria | Estado estabilizado |
| --- | --- | --- | --- | --- |
| ISS → Hubble | Confirmada | Hubble | Atualizada | `from: ""`, `to: "hubble"` |
| Hubble → Tiangong | Confirmada | Tiangong | Atualizada | `from: ""`, `to: "tiangong"` |
| Tiangong → NOAA 19 | Confirmada | NOAA 19 | Atualizada | `from: ""`, `to: "noaa19"` |
| NOAA 19 → ISS | Confirmada | ISS | Atualizada | `from: ""`, `to: "iss"` |

Em ambos os viewports, cada troca informou corretamente o par de origem e destino durante 500 ms, transferiu o destaque laranja do marcador anterior para o novo e manteve painel externo e telemetria sincronizados.
