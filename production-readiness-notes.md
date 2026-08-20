# Auditoria de Prontidão — evidências visuais

## Renderização e recuperação

Após restaurar a configuração do Vite como objeto resolvido por ambiente, a prévia voltou a servir `src/main.tsx` como módulo TypeScript. As capturas de 1280 px confirmaram que a página principal, a rota 404 em português e a recuperação controlada do limite de erro renderizam sem tela em branco. A recuperação mostra mensagem segura e botão de recarga, sem stacktrace.

## Achado de usabilidade

O banner de consentimento aparece também sobre a rota 404 e a recuperação de erro na primeira visita. Embora os controles principais permaneçam presentes, a camada reduz a clareza dessas rotas. A auditoria manterá o banner em conteúdo normal, mas o ocultará durante o estado de recuperação e em rota não encontrada.
