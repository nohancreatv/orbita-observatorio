# Matriz de Hardening de Segurança

**Projeto:** Órbita (`iss-overhead`)  
**Escopo:** avaliação proporcional aos recursos efetivamente presentes no observatório público.  
**Status:** controles aplicáveis implementados e validados.

## Controles aplicados

| Controle solicitado | Decisão e implementação |
|---|---|
| Ocultar chaves de API | **Aplicado.** Segredos permanecem apenas em variáveis de servidor; a varredura do build confirma ausência de `NASA_API_KEY`, `JWT_SECRET`, chave Forge, caminhos locais e placeholders de ambiente. O Publisher ID do AdSense permanece público por natureza do provedor. |
| Remover segredos do Git | **Verificado e prevenido.** A varredura histórica encontrou apenas referências a nomes de variáveis em código e testes, não arquivos de ambiente ou chaves versionadas. `.gitignore` agora cobre `.env.*`, PEM, KEY, P12/PFX, certificados e arquivos de credenciais. Nenhuma reescrita de histórico é necessária. |
| Autenticação no servidor | **Aplicado.** O servidor valida sessão assinada em cookie httpOnly; o fallback por Bearer token de `sessionStorage` foi removido do cliente e do servidor. Procedures protegidas e administrativas continuam disponíveis para futuras rotas privadas. |
| Bloqueio de adulteração de campos | **Aplicado.** O upsert OAuth aceita apenas identificador, nome, método e data de login. `role` não é mais atributo de entrada: somente o OpenID configurado como proprietário pode receber `admin` no servidor. |
| Cookies de sessão seguros | **Aplicado.** Cookies usam `httpOnly`, `path=/`, `SameSite=Lax`, validade de 30 dias e `Secure` forçado em produção. O nonce OAuth também usa cookie host-only de curta duração e primeira parte. |
| Proteção contra bots | **Aplicado de forma proporcional.** Todas as consultas orbitais públicas passam por limite por IP, resposta `TOO_MANY_REQUESTS`, `Retry-After` e limpeza de buckets expirados com teto de memória. CAPTCHA não foi incluído porque não há criação de conta, formulário público ou ação valiosa que o justifique. |
| Consultas parametrizadas | **Aplicado.** O único acesso ao banco passa pelo Drizzle ORM e filtros tipados; não há SQL montado por concatenação de entrada pública. |
| Validação de entradas | **Aplicado.** Coordenadas e identificadores passam por schemas Zod; a rota pública de ativos valida tamanho, caracteres e segmentos de chave antes de solicitar URL assinada. |
| Escape de conteúdo | **Aplicado.** A interface usa renderização React sem HTML de usuário; a política CSP limita scripts, frames, imagens, conexões e base URI. |
| Restringir uploads | **Aplicado por ausência de superfície.** O produto não expõe upload para visitantes; o proxy de armazenamento é somente `GET` e não fornece URLs de escrita. |
| Enxugar respostas da API | **Aplicado.** `auth.me` retorna somente nome e função; OpenID, método de login, timestamps e e-mail não são enviados ao cliente. O fluxo OAuth também deixou de persistir e-mail, pois o observatório não o utiliza. |
| Cabeçalhos e HTTPS | **Aplicado.** CSP restrita a `self` e AdSense pós-consentimento, HSTS, `nosniff`, anti-frame, políticas de permissões/referrer/origem e `upgrade-insecure-requests`. APIs recebem `Cache-Control: no-store, max-age=0`. |
| Dependências | **Aplicado.** `pnpm audit --prod --audit-level high` não reporta vulnerabilidades conhecidas. |

## Controles não aplicáveis atualmente

| Controle solicitado | Motivo técnico |
|---|---|
| Chave pública do banco | O navegador não acessa o banco. A URL de banco e as credenciais ficam exclusivamente no processo do servidor; portanto não há chave pública de banco a expor ou configurar. |
| RLS | A aplicação usa MySQL/TiDB com acesso exclusivamente pelo servidor e não oferece consultas diretas do navegador. Não há política de linha para ativar nessa arquitetura; as rotas não expõem registros de usuário. |
| Criptografia de dados sensíveis | Não existem documentos, pagamentos, senhas, coordenadas persistentes do visitante ou conteúdo sensível enviado por usuários. A única informação pessoal opcional que seria recebida do OAuth — e-mail — deixou de ser persistida. Criptografia de campo será necessária se o produto passar a guardar dados sensíveis. |
| Bloqueio de acesso a registros | Não há CRUD de registros de usuário, nem endpoint público para listar ou alterar perfis. O banco só é consultado internamente para validar a sessão. Qualquer funcionalidade futura de registros deve começar com `protectedProcedure` e verificação de propriedade no servidor. |
| Hash de senhas | Não há senha local: a identidade é delegada ao OAuth. Armazenar hash sem um fluxo de senha seria código morto e não aumentaria a segurança. |

## Evidências de validação

| Verificação | Resultado |
|---|---|
| Tipagem | `pnpm check` aprovado. |
| Testes | 11 arquivos e 17 testes aprovados, incluindo sessão somente por cookie, perfil mínimo, rate limiter e chave de armazenamento. |
| Regressões funcionais | Consentimento, alertas, layout, transições desktop/móvel, marcadores e contingências continuam aprovados. |
| Auditoria de dependências | Sem vulnerabilidades conhecidas em dependências de produção. |
| Artefato público | Sem segredos de servidor, runtime de desenvolvimento, analytics externo, caminhos locais ou placeholders de ambiente. |
| Smoke HTTP de produção | CSP reduzida, HSTS, políticas de origem, APIs com `no-store` e entrega estática confirmadas. |

## Regra para evoluções futuras

Se forem adicionados uploads, perfis editáveis, favoritos sincronizados, e-mail, pagamentos ou notificações persistentes, a implementação deve incluir uma nova auditoria antes do lançamento: autenticação obrigatória, verificação de propriedade por registro, esquema de dados com minimização, política de retenção e criptografia adequada ao dado coletado.
