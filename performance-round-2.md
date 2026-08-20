# Medição de bundle — rodada 2

## Resultado de produção

| Artefato | Antes da rodada | Depois da rodada | Leitura |
|---|---:|---:|---|
| Entrada principal | 709,07 kB / 202,41 kB gzip | 322,45 kB / 84,02 kB gzip | O código específico da página foi separado do runtime React e do runtime 3D. |
| Componente do globo | 1.017,90 kB / 275,03 kB gzip | 11,69 kB / 2,74 kB gzip | O componente passou a ser um carregador leve que importa o runtime pesado sob demanda. |
| Runtime React | incluso na entrada | 400,44 kB / 118,13 kB gzip | Segmento estático reutilizável pelo navegador. |
| Runtime Three.js + React Three Fiber | incluso no chunk do globo | 1.005,14 kB / 272,62 kB gzip | Permanece adiado até existir uma primeira telemetria orbital, preservando a renderização inicial textual e o fallback do globo. |

## Decisão

O chunk 3D continua acima do limite de aviso do Vite, mas não entra mais no caminho de carga da aplicação antes da primeira resposta de telemetria. A redução adicional de geometria — Terra de 72 para 56 segmentos, nuvens/atmosfera de 56 para 44, marcadores de 16 para 12 e anisotropia de 4 para 2 — reduz trabalho de GPU sem remover a leitura cartográfica. O aviso foi mantido visível porque uma redução material adicional exigiria substituir ou customizar o runtime Three.js, com risco desproporcional para a fidelidade e estabilidade do globo.
