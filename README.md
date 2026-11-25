# Auth-proxy
Desenvolvimento de microservice de autentcação user.

- **Fase A:** login com Active Directory via LDAPS e sessão em JWT.
- **Fase B:** login com Microsoft Entra ID (OIDC).

O gateway fica na frente da aplicação e repassa o usuário autenticado
em cabeçalhos `X-Forwarded-*`. A aplicação não implementa login.

## Requisitos

- Node.js 24 ou superior

## Como rodar

```bash
npm install
cp .env.example .env   # no PowerShell: Copy-Item .env.example .env
npm run dev
```

Teste: `GET http://127.0.0.1:3000/health` deve responder `{"status":"ok"}`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe com recarga automática e lê o `.env` |
| `npm start` | Sobe sem recarga (produção) |
| `npm test` | Roda os testes (`node:test`) |
| `npm run lint` | Analisa o código com ESLint |

## Configuração

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `HOST` | Não | `127.0.0.1` | Em produção, precisa ser loopback |
| `PORT` | Não | `3000` | Porta interna |
| `PUBLIC_URL` | Sim | | URL acessada pelo navegador. Em produção, `https` |

O serviço não sobe se alguma variável for inválida e lista todos os problemas.

## Licença

MIT