# Backlog: Serviço de Autenticação infra-auth em Planning Poker

> **Projeto:** infra-auth (login AD via LDAPS + JWT, depois Microsoft Entra ID)
> **Consumidores:** InfraPrint (primeiro), Create Usuário (depois)
> **Servidor alvo:** Tickway (Windows Server, IIS com HTTPS)
> **Repositório:** GitHub pessoal do Pedro (público, autorizado pelo Bruno)
> **Desenvolvedor:** Pedro Gustavo
> **Data:** 25/11/2026
> **Versão:** 0.2
> **Status:** estimativas **sugeridas**, pendentes de votação

### Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1 | 19/11/2026 | Backlog inicial só com Entra ID (MSAL) |
| 0.2 | 25/11/2026 | Login AD via LDAPS + JWT primeiro; Entra ID vira fase B; LDAPS fica como contingência |

---

## 1. Decisões desta versão

1. **Fase A:** login com usuário e senha do **AD local**, validados via **LDAPS (TCP 636)**. O serviço não guarda nenhuma senha.
2. **Sessão por JWT** assinado, em cookie `HttpOnly`. Substitui o `express-session` da versão 0.1.
3. **Fase B:** login com **Microsoft Entra ID** (MSAL Node). Ao final, o usuário escolhe "Entrar com Microsoft".
4. **Contingência:** o login AD continua disponível depois do Entra, restrito a um grupo e com alerta de uso.
5. **Contrato de cabeçalhos mantido:** o InfraPrint não muda entre a fase A e a fase B.

---

## 2. Como usar este documento

Os pontos são um **ponto de partida**. O valor final vai na coluna "Votado".

### 2.1 Escala (Fibonacci modificada)

| Carta | Significado |
|---|---|
| **1** | Trivial, sem dúvida técnica |
| **2** | Pequena, caminho conhecido |
| **3** | Média, alguma pesquisa |
| **5** | Grande, várias partes ou primeira vez fazendo |
| **8** | Muito grande ou com incerteza relevante |
| **13** | Grande demais: **quebrar** antes de entrar na sprint |
| **?** | Falta informação para estimar |
| **☕** | Pausa |

Pontos medem **esforço + complexidade + incerteza**. Não são horas.

### 2.2 Histórias âncora

- **1 ponto:** rota `GET /health` que devolve `200 OK`.
- **3 pontos:** middleware que lê o JWT do cookie, valida e devolve 401 se for inválido.

### 2.3 Roteiro da sessão

1. Ler a história e o critério de aceite.
2. Tirar dúvidas, sem falar números.
3. Mostrar as cartas **ao mesmo tempo**.
4. Diferença de mais de uma carta: quem deu o maior e o menor explicam.
5. Revotar no máximo 2 vezes, depois fica a mediana.
6. Registrar em "Votado".
7. Carta **?** ou **13**: a história volta para refinamento.

Como o projeto é solo, a seção 11.1 do `fluxo-desenvolvimento-infra-auth.md` adapta esse roteiro para uma pessoa.

---

## 3. Definições

### 3.1 Definition of Ready

- Critério de aceite escrito.
- Dependências identificadas (conta de serviço AD, App Registration, etc.).
- Sem carta **?** na última votação.

### 3.2 Definition of Done

- Código no repositório com PR aprovado no checklist de auto-revisão.
- Teste automatizado ou roteiro manual registrado.
- Nenhum segredo, senha ou dado interno da InfraBrasil no repositório público.
- Funcionando em homologação.
- README ou runbook atualizado.

---

## 4. Contrato do serviço

O serviço valida o JWT e repassa ao app apenas estes cabeçalhos. Qualquer `X-Forwarded-*` vindo do navegador é descartado antes.

| Cabeçalho | Conteúdo |
|---|---|
| `X-Forwarded-User` | E-mail normalizado em minúsculas (chave única entre AD e Entra) |
| `X-Forwarded-Email` | E-mail do usuário |
| `X-Forwarded-Preferred-Username` | Login (`sAMAccountName` no AD, `preferred_username` no Entra) |
| `X-Forwarded-Groups` | Papéis separados por vírgula (ex.: `InfraPrint.Usuario`) |
| `X-Forwarded-Auth-Method` | `ldap` ou `entra` (novo, para auditoria) |

**Papéis iguais nas duas fases:**

- **AD:** grupos do AD (inclusive aninhados) mapeados por configuração. Ex.: `GG-InfraPrint-Usuarios` vira `InfraPrint.Usuario`.
- **Entra:** App Roles com o mesmo nome (`InfraPrint.Usuario`, `InfraPrint.Admin`).

**Lacuna crítica:** como AD e M365 não sincronizam, o e-mail no AD (atributo `mail`) pode não bater com o UPN do M365. Se não bater, a mesma pessoa vira dois usuários no InfraPrint. Validar uma amostra antes da sprint 2.

---

## 5. Desenho do JWT

| Item | Decisão sugerida |
|---|---|
| Biblioteca | `jose` (sem implementar assinatura na mão) |
| Algoritmo | `EdDSA` ou `RS256`, **fixo** na validação (nunca aceitar o `alg` do token) |
| Claims | `sub` (e-mail), `name`, `roles`, `amr` (`ldap`/`entra`), `iss`, `aud`, `iat`, `exp`, `jti` |
| Token de acesso | Curto (ex.: 15 min), em cookie `HttpOnly`, `Secure`, `SameSite=Lax` |
| Refresh token | Opaco (não é JWT), guardado só como hash em SQLite, trocado a cada uso |
| Logout | Revoga o refresh token e apaga os cookies |
| Chave | Par de chaves fora do repositório, com `kid` para permitir troca |

Não tenho certeza, mas 15 minutos é um ponto comum de partida para token de acesso. Ajustar depois de medir o uso real.

---

## 6. Backlog estimado

### Épico 1: Preparação e base

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E1-01 | Criar repositório público no GitHub com secret scanning, push protection, Dependabot, proteção da `main` e licença | Configurações ativas e conferidas | 2 | |
| E1-02 | Estrutura Express, lint e scripts `npm` | `npm run dev` sobe o serviço | 2 | |
| E1-03 | Configuração por variável de ambiente, validada na subida | Serviço não inicia se faltar variável | 2 | |
| E1-04 | Rota `GET /health` | Retorna 200 sem exigir login | 1 | |
| E1-05 | Solicitar **conta de serviço do AD só leitura** (busca de usuário e grupos) | Conta criada; senha entregue por canal seguro | 1 | |

**Subtotal sugerido:** 8 pontos
**Dependência externa:** E1-05 depende do Bruno/Kevin e bloqueia o Épico 2.

### Épico 2: Login AD via LDAPS (fase A)

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E2-01 | Cliente `ldapts` em `ldaps://` (636), validando o certificado da CA interna | Conexão falha se o certificado não for da CA interna | 3 | |
| E2-02 | Tela `GET /login` com formulário e token CSRF | POST sem token CSRF é recusado | 2 | |
| E2-03 | `POST /login`: buscar o usuário com a conta de serviço (filtro com escape) e fazer bind com a senha dele | Usuário válido entra; senha errada não | 5 | |
| E2-04 | Recusar senha vazia, conta desabilitada e usuário fora da OU permitida | Os 3 casos negados e registrados no log | 3 | |
| E2-05 | Ler grupos do usuário (inclusive aninhados) e mapear para papéis por configuração | Papéis corretos no JWT | 3 | |
| E2-06 | Erro genérico ("usuário ou senha inválidos") e volta segura para a URL original | Mensagem não revela se o usuário existe | 2 | |

**Subtotal sugerido:** 18 pontos

> **Atenção E2-04:** no AD, bind com senha vazia pode ser aceito como bind anônimo e parecer login válido. Testar esse caso explicitamente.

### Épico 3: JWT e sessão

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E3-01 | Emitir JWT de acesso com `jose` e as claims da seção 5 | Token decodificado mostra as claims certas | 3 | |
| E3-02 | Gravar o JWT em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, curta duração | Flags conferidas no navegador | 1 | |
| E3-03 | Middleware de validação: assinatura, `alg` fixo, `iss`, `aud`, `exp` | Token adulterado, vencido ou com `alg` trocado é recusado | 3 | |
| E3-04 | Refresh token opaco com hash em SQLite e rotação a cada uso | Refresh reutilizado invalida a sessão inteira | 5 | |
| E3-05 | Logout: revogar refresh e apagar cookies | Após sair, novo acesso exige login | 2 | |
| E3-06 | Troca da chave de assinatura com `kid` | Tokens da chave antiga valem até expirar; novos usam a nova | 3 | |

**Subtotal sugerido:** 17 pontos

### Épico 4: Proxy reverso e autorização

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E4-01 | Encaminhar requisições autenticadas com `http-proxy-middleware` | App de teste responde através do serviço | 3 | |
| E4-02 | **Remover** qualquer `X-Forwarded-*` vindo do cliente | Cabeçalho forjado não chega ao app | 2 | |
| E4-03 | Injetar os cabeçalhos do contrato (seção 4) | App de teste exibe os valores corretos | 2 | |
| E4-04 | Bloquear usuário sem papel permitido para o app | Retorna 403 com página de acesso negado | 2 | |
| E4-05 | Vários apps por configuração (InfraPrint e Create Usuário) | Dois apps com papéis diferentes funcionando | 5 | |

**Subtotal sugerido:** 14 pontos

### Épico 5: Segurança, logs e testes

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E5-01 | Log de auditoria (login, falha, logout, 403), **sem senha nem token** | Log com data, usuário, IP, método e evento | 3 | |
| E5-02 | `helmet` + limite de tentativas por IP e por usuário no `POST /login`, abaixo do limite de bloqueio do AD | Ataque de força bruta não bloqueia contas no AD | 3 | |
| E5-03 | Testes automatizados com LDAP simulado | `npm test` cobre login, senha vazia, JWT inválido, logout e 403 | 5 | |
| E5-04 | Roteiro manual: spoof de cabeçalho, porta direta, JWT adulterado, refresh reutilizado | Roteiro executado e evidências registradas | 3 | |
| E5-05 | Lembretes de troca: senha da conta de serviço, chave JWT, secret do Entra | Datas no runbook e lembretes criados | 1 | |

**Subtotal sugerido:** 15 pontos

### Épico 6: Implantação no Tickway

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E6-01 | Checklist: Node, portas livres, DNS, certificado e **rota do Tickway até o DC na 636** | Checklist preenchido pelo Kevin | 2 | |
| E6-02 | Rodar como serviço Windows (WinSW ou NSSM) | Sobe sozinho após reinício | 3 | |
| E6-03 | IIS (URL Rewrite + ARR) apontando para `127.0.0.1` | HTTPS funciona; porta interna bloqueada externamente | 5 | |
| E6-04 | Segredos em variável de ambiente com ACL restrita à conta do serviço | Usuário comum do servidor não lê os segredos | 2 | |
| E6-05 | Runbook de implantação e rollback (privado, no SharePoint) | Documento publicado | 2 | |

**Subtotal sugerido:** 14 pontos

### Épico 7: Integração com o InfraPrint (fim da fase A)

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E7-01 | Middleware no InfraPrint lendo os cabeçalhos do contrato | `req.usuario` preenchido nas rotas protegidas | 2 | |
| E7-02 | InfraPrint escutando só em `127.0.0.1` | Acesso direto pela rede falha | 1 | |
| E7-03 | Papéis para permissões do portal (usuário × admin) | Telas de admin só para `InfraPrint.Admin` | 3 | |
| E7-04 | Aceite com usuários reais (login AD), incluindo acesso de obra | Bruno aprova; evidências no chamado do Agidesk | 3 | |

**Subtotal sugerido:** 9 pontos

### Épico 8: Login Microsoft Entra ID (fase B)

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E8-01 | Solicitar App Registrations (dev com `localhost`, homologação e produção) | Tenant ID e Client IDs recebidos | 1 | |
| E8-02 | Configurar `ConfidentialClientApplication` da MSAL Node | Cliente instanciado corretamente | 2 | |
| E8-03 | Botão "Entrar com Microsoft": `GET /login/microsoft` com PKCE, `state` e `nonce` | Redireciona para a Microsoft | 3 | |
| E8-04 | `GET /auth/callback`: validar `state` e trocar o código por tokens | Usuário volta logado; `state` inválido retorna 400 | 5 | |
| E8-05 | Converter claims do Entra para **o mesmo JWT interno** (`amr=entra`, App Roles em `roles`) | InfraPrint recebe os mesmos cabeçalhos, só muda o método | 3 | |
| E8-06 | Tratar erros do Entra (sem atribuição, consentimento, cancelamento) | Página amigável e código de erro no log | 3 | |
| E8-07 | Logout também na Microsoft | Após sair, novo acesso pede login | 2 | |

**Subtotal sugerido:** 19 pontos

### Épico 9: Contingência com login AD

| ID | História | Critério de aceite | Sugerido | Votado |
|---|---|---|---|---|
| E9-01 | Liga/desliga do login AD por app, via configuração | Com a opção desligada, `POST /login` retorna 404 | 2 | |
| E9-02 | Restringir o login AD em contingência a um grupo específico (ex.: `GG-InfraAuth-Contingencia`) | Usuário fora do grupo é negado | 2 | |
| E9-03 | Destaque no log e alerta quando o login de contingência for usado | Evento aparece separado na auditoria | 2 | |
| E9-04 | Teste de falha: simular Entra fora do ar e entrar pelo AD | Roteiro executado com evidência | 2 | |
| E9-05 | Procedimento: quem ativa, por quanto tempo e como desliga | Documento no runbook | 1 | |

**Subtotal sugerido:** 9 pontos

---

## 7. Resumo das estimativas sugeridas

| Épico | Fase | Pontos sugeridos | Pontos votados |
|---|---|---|---|
| E1 Preparação e base | A | 8 | |
| E2 Login AD via LDAPS | A | 18 | |
| E3 JWT e sessão | A | 17 | |
| E4 Proxy e autorização | A | 14 | |
| E5 Segurança, logs e testes | A | 15 | |
| E6 Implantação no Tickway | A | 14 | |
| E7 Integração InfraPrint | A | 9 | |
| E8 Login Entra ID | B | 19 | |
| E9 Contingência | B | 9 | |
| **Total** | | **123** | |

**Fase A (InfraPrint em produção com login AD):** 95 pontos.
**Fase B (Entra ID + contingência):** 28 pontos.

### 7.1 Como transformar pontos em prazo

Não converter pontos em horas agora. Não tenho fonte verificada para uma taxa que sirva para este projeto.

1. Rodar a primeira sprint (2 semanas).
2. Somar só os pontos **entregues** (Definition of Done). Essa é a velocidade.
3. Repetir na segunda sprint e tirar a média.
4. Prazo estimado = pontos restantes ÷ velocidade média.
5. Comparar com o prazo de 3 meses do InfraPrint e avisar o Bruno cedo.

### 7.2 Ordem sugerida de sprints

| Sprint | Foco | Histórias |
|---|---|---|
| 1 | Base e conexão LDAPS | E1 completo, E2-01, E2-02, E6-01 (antecipado) |
| 2 | Login AD completo | E2-03 a E2-06, E3-01, E3-02 |
| 3 | JWT e início do proxy | E3-03 a E3-06, E4-01, E4-02 |
| 4 | Proxy e segurança | E4-03 a E4-05, E5 completo |
| 5 | Implantação | E6-02 a E6-05 |
| 6 | InfraPrint em produção (versão 1.0.0) | E7 completo |
| 7 | Entra ID | E8 completo |
| 8 | Contingência | E9 completo |

São 6 sprints até o InfraPrint usar o serviço, ou seja, cerca de 12 semanas. Fica no limite dos 3 meses: a velocidade medida nas sprints 1 e 2 diz se cabe.

---

## 8. Riscos que afetam a estimativa

| Risco | Efeito | Ação |
|---|---|---|
| E-mail do AD diferente do UPN do M365 | Mesma pessoa vira dois usuários na fase B | Comparar amostra antes da sprint 2 |
| Senha do AD passa pelo serviço (no SSO isso não acontece) | Vazamento se houver log ou HTTP sem TLS | TLS de ponta a ponta; nunca logar o corpo do `POST /login` |
| Tentativas erradas bloqueando contas no AD | Usuários travados em massa | Limite de tentativas abaixo da política do AD (confirmar o valor com o Kevin) |
| Tickway sem rota até o DC na porta 636 | Bloqueia o E2 em homologação | E6-01 antecipado para a sprint 1 |
| Conta de serviço com privilégio demais | Brecha grave se o segredo vazar | Só leitura, sem login interativo, senha forte com troca agendada |
| Dado interno no repositório público | Exposição do ambiente | Checklist do PR e secret scanning ativos desde o E1-01 |
| Prazo apertado do InfraPrint | Fase A pode passar de 3 meses | Plano B: oauth2-proxy na fase B, mantendo o contrato |

---

## 9. Próximo passo

Pedir ao Bruno a conta de serviço do AD só leitura (E1-05). É a única dependência externa da fase A.
