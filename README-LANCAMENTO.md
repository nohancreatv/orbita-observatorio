# Lançamento responsável — Órbita

## O que já está configurado

A aplicação possui servidor para intermediar provedores externos, mantém a credencial NASA apenas no ambiente do servidor, valida coordenadas recebidas, define tempo máximo para fontes externas, aplica cache, limita consultas públicas por instância e não persiste a geolocalização informada no navegador.

Em produção, o servidor também desativa sua identificação padrão e envia políticas para restringir conteúdo carregado, enquadramento por outros sites, tipos MIME, origem de referência, acesso a câmera/microfone e geolocalização fora do próprio domínio. A política de conteúdo permite apenas os recursos necessários ao observatório.

> A limitação de requisições atual é mantida em memória por instância. Em uma publicação com múltiplas instâncias ou tráfego elevado, habilite também uma proteção de borda/WAF e monitore limites dos provedores.

## Antes de publicar

| Frente | Ação obrigatória | Responsável |
| --- | --- | --- |
| Identidade | Inserir razão social ou responsável, e-mail de contato, país aplicável e data de vigência nas páginas de privacidade e termos. | Proprietário do site |
| Jurídico | Revisar os textos de privacidade, termos, cookies e tratamento de dados para a jurisdição do lançamento; no Brasil, considerar a LGPD. | Assessoria jurídica |
| Domínio | Conectar domínio próprio, confirmar HTTPS e definir um endereço de contato de suporte. | Proprietário do site |
| Dados | Confirmar termos, atribuições e limites de Where the ISS at?, CelesTrak, NASA e BigDataCloud. | Proprietário do site |
| Credenciais | Manter `NASA_API_KEY` apenas nos segredos do projeto e rotacioná-la se houver exposição suspeita. | Administrador técnico |
| Segurança | Aplicar cabeçalhos no ambiente de produção, testar CSP sem violações e executar auditoria de cabeçalhos após publicar. | Administrador técnico |
| Operação | Criar monitoramento de erros, definir responsável por incidentes e avaliar cache/WAF de borda para alto tráfego. | Operação |

## Validações de lançamento

1. Execute `pnpm check` e `pnpm test` antes de cada versão.
2. Teste o consentimento de geolocalização, a recusa de permissão e a indisponibilidade de cada fonte pública.
3. Abra as páginas `/privacidade`, `/termos` e `/fontes` no domínio final e confira links e identificação do responsável.
4. Após publicar, faça uma auditoria de cabeçalhos HTTP, verifique a CSP e consulte os logs de erro durante a primeira semana.

## Referências

[1] [CelesTrak — GP Data Formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) descreve consultas por catálogo NORAD e formatos dos elementos orbitais.

[2] [NASA Open APIs](https://api.nasa.gov/) documenta a chave de desenvolvimento e seus limites de requisição.

[3] [MDN — Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) apresenta o mecanismo para restringir fontes de conteúdo carregado.

[4] [MDN — Permissions Policy para geolocalização](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation) descreve o controle de acesso à API de geolocalização.

