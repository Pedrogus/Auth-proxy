# Changelog

Formato baseado em Keep a Changelog. Versões seguem SemVer.

## [Não lançado]

### Adicionado
- Estrutura do projeto em Node.js 24 (ESM) com Express.
- ESLint com regras de qualidade e de segurança.
- Carregamento e validação da configuração na subida (E1-03).
- Rota `GET /health` e respostas genéricas de 404 e 500 (E1-04).
- Testes unitários e de integração com `node:test` e `supertest`.
- Página de login com proteção CSRF (cookie assinado com HMAC) e checagem de Origin (E2-02).
- Respostas 4xx de leitura do corpo sem registro em log, para não gravar senhas.