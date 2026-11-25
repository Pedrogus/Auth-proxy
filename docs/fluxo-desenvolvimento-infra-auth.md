# Fluxo de Desenvolvimento: infra-auth (Serviço de Login AD + JWT, depois Entra ID)

> **Projeto:** infra-auth (Node.js, `ldapts`, `jose`; MSAL Node na fase B)
> **Desenvolvedor:** Pedro Gustavo (projeto solo)
> **Aprovação de entregas:** Bruno Goes
> **Servidor alvo:** Tickway (Windows Server, IIS com HTTPS)
> **Repositório:** GitHub pessoal do Pedro (público, autorizado pelo Bruno)
> **Data:** 25/11/2026
> **Versão:** 0.2
> **Documentos relacionados:** `backlog-auth-service-planning-poker.md`, `arquitetura-sso-entra-id-oauth2-proxy.md`

### Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1 | 19/11/2026 | Fluxo inicial só com Entra ID |
| 0.2 | 25/11/2026 | Fase A com login AD via LDAPS + JWT; repositório público no GitHub; Entra ID na fase B |

---

## 1. Visão geral do ciclo

```text
 Backlog ──► Estimar ──► Branch ──► Codar + testar ──► Auto-revisão (PR)
                                                            │
     ┌──────────────────────────────────────────────────────┘
     ▼
 Merge na main ──► Deploy homologação ──► Validar critério de aceite ──► Done
                                                            │
                                     (a cada fim de sprint) ▼
                                 Release (tag) ──► Aprovação Bruno ──► Produção
```

**Fases do projeto:**

- **Fase A:** login com usuário e senha do AD (LDAPS) e sessão em JWT. Termina com o InfraPrint em produção.
- **Fase B:** botão "Entrar com Microsoft" (Entra ID). O login AD fica como contingência.

Processo leve por ser solo, mas as etapas de segurança não são opcionais.

---

## 2. Ambientes

| Ambiente | Onde roda | Diretório (LDAPS) | Conta de serviço AD | App Registration (fase B) | Chave JWT |
|---|---|---|---|---|---|
| **Local** | Sua máquina | LDAP simulado ou DC via VPN | `svc-infraauth-dev` | `infra-auth-dev` (`localhost`) | Própria do dev |
| **Homologação** | Tickway, host de homolog | DC da InfraBrasil, porta 636 | `svc-infraauth-hml` | `infra-auth-hml` | Própria da hml |
| **Produção** | Tickway, host oficial | DC da InfraBrasil, porta 636 | `svc-infraauth-prd` | `infra-auth-prd` | Própria da prd |

Nomes de contas são sugestões. Confirmar o padrão de nomenclatura do AD com o Kevin.

**Regras:**

- Cada ambiente tem **seus próprios** segredos. Nunca reaproveitar os de produção.
- Homologação e produção usam portas internas diferentes (ex.: 3100 e 3000).
- Dados de usuários reais só em homologação controlada e produção (LGPD).

---

## 3. Repositório e branches

### 3.1 Estratégia: trunk-based simplificado

| Branch | Uso | Regra |
|---|---|---|
| `main` | Código sempre estável, pronto para homologação | Só recebe merge via PR |
| `feat/<ID>-<descricao>` | Uma história do backlog | Ex.: `feat/E2-03-post-login` |
| `fix/<descricao>` | Correção de bug | Ex.: `fix/senha-vazia-aceita` |
| `hotfix/<descricao>` | Correção urgente em produção | Sai da última tag, volta para `main` |

Branches vivem **no máximo alguns dias**. História grande demais volta para o backlog e é quebrada.

### 3.2 Padrão de commits (Conventional Commits + ID da história)

```text
<tipo>(<ID>): <o que mudou, no imperativo>

feat(E2-03): valida senha no AD via bind LDAPS
sec(E2-04): recusa bind com senha vazia
feat(E3-04): rotaciona refresh token a cada uso
test(E5-03): cobre JWT com alg adulterado
docs(E6-05): adiciona procedimento de rollback
```

| Tipo | Quando usar |
|---|---|
| `feat` | Funcionalidade nova |
| `fix` | Correção |
| `sec` | Ajuste de segurança (facilita auditoria) |
| `test` | Só testes |
| `docs` | Só documentação |
| `refactor` | Mudança sem alterar comportamento |
| `chore` | Dependências, configuração, scripts |

### 3.3 Repositório público, configuração privada

O código é genérico e fica no seu GitHub. Tudo que identifica a InfraBrasil fica fora dele.

| Onde | O que fica |
|---|---|
| **GitHub (público)** | Código, testes, README com exemplos fictícios (`contoso.local`, `dc01.contoso.local`), `.env.example` só com nomes |
| **Privado (SharePoint da TI)** | `.env` reais, hosts, DN das OUs, nomes de grupos, runbook do Tickway, evidências de teste |

**Configurações do GitHub (história E1-01):**

1. Secret scanning e push protection ligados.
2. Dependabot alerts ligado.
3. Proteção da `main`: só merge via PR.
4. Licença definida (ex.: MIT), combinada com o Bruno.
5. Autenticação em dois fatores na sua conta.

Se um segredo for commitado por engano, **trocar o segredo na origem** primeiro. Apagar do histórico não basta num repositório público.

---

## 4. Estrutura de pastas

```text
infra-auth/
├── src/
│   ├── config/          # leitura e validação de variáveis de ambiente
│   ├── auth/
│   │   ├── ldap/        # ldapts: busca, bind, grupos (fase A)
│   │   └── entra/       # MSAL: /login/microsoft, /auth/callback (fase B)
│   ├── token/           # jose: emitir e validar JWT, rotação de chaves
│   ├── store/           # SQLite: refresh tokens (só hash)
│   ├── proxy/           # http-proxy-middleware, limpeza e injeção de cabeçalhos
│   ├── authz/           # mapeamento grupos/App Roles para papéis, checagem por app
│   ├── audit/           # log de auditoria
│   ├── views/           # tela de login e páginas de erro
│   └── server.js        # monta o Express
├── test/
│   ├── unit/
│   └── integration/     # supertest + LDAP simulado + Entra simulado
├── docs/
│   └── decisoes/        # registro de decisões técnicas (ADR)
├── .env.example         # nomes das variáveis, sem valores
├── .gitignore           # .env, logs/, data/, chaves
├── CHANGELOG.md
├── LICENSE
├── package.json
└── README.md
```

O runbook com dados reais **não** fica aqui. Vai para o SharePoint (seção 3.3).

---

## 5. Ciclo de cada história

1. **Escolher** a próxima história da sprint e conferir se está "Ready".
2. **Criar a branch** a partir da `main` atualizada.
3. **Escrever o teste primeiro** quando for lógica (bind, JWT, autorização). Para infra, escrever o roteiro manual.
4. **Implementar** até o teste passar. Commits pequenos e frequentes.
5. **Rodar localmente:** `npm run lint`, `npm test`, `npm audit`.
6. **Abrir o PR** e passar pelo checklist (seção 6). Revisar no dia seguinte, se possível.
7. **Merge, deploy em homologação** e validar o critério de aceite. Só então marcar como Done.

---

## 6. Checklist de auto-revisão (PR)

Copiar no corpo de cada PR.

```markdown
### Funcional
- [ ] Critério de aceite da história atendido
- [ ] Testes novos ou atualizados passando

### Segurança
- [ ] Nenhum segredo, senha ou token no código, commit ou log
- [ ] Corpo do POST /login nunca é logado
- [ ] Filtros LDAP montados com escape (sem concatenar entrada do usuário)
- [ ] Senha vazia continua sendo recusada
- [ ] JWT validado com alg fixo, iss, aud e exp
- [ ] Cabeçalhos X-Forwarded-* do cliente continuam sendo removidos
- [ ] Erros não expõem stack trace nem dizem se o usuário existe

### Repositório público
- [ ] Nenhum host, IP, DN, grupo ou e-mail real da InfraBrasil
- [ ] Exemplos usam domínio fictício

### Qualidade
- [ ] Sem código comentado ou console.log esquecido
- [ ] README atualizado, se mudou configuração
- [ ] CHANGELOG atualizado
```

**Épicos E2 (LDAPS), E3 (JWT), E4 (proxy) e E5 (segurança):** pedir uma revisão rápida ao Bruno ou ao Kevin. São os que mais podem abrir brecha.

---

## 7. Testes

| Nível | Ferramenta sugerida | O que cobre | Quando roda |
|---|---|---|---|
| Unitário | `node:test` ou Vitest | Config, mapeamento de papéis, limpeza de cabeçalhos, validação de JWT | A cada commit |
| Integração | Supertest + LDAP simulado | `POST /login`, senha vazia, conta desabilitada, refresh, logout, 403 | Antes de cada PR |
| Integração (fase B) | Supertest + Entra simulado | `/login/microsoft`, `/auth/callback`, erros do Entra | Antes de cada PR |
| Manual em homologação | Roteiro privado | Login real no AD, acesso de obra, Entra real (fase B) | Antes de marcar Done |
| Segurança manual | Roteiro do E5-04 | Spoof de cabeçalho, porta direta, JWT adulterado, refresh reutilizado | A cada release |

**Regras:**

- Nunca usar conta, senha ou secret real em teste automatizado.
- LDAP e Entra são sempre simulados nos testes do repositório público.
- Não usar `ldapjs`: o pacote foi descontinuado pelos mantenedores (npm, 2024). O cliente do projeto é o `ldapts`.

---

## 8. Segredos e configuração

| Segredo | Fase | Se vazar, trocar em |
|---|---|---|
| Senha da conta de serviço do AD | A | AD (reset pela infra) |
| Chave privada de assinatura do JWT | A | Gerar par novo com novo `kid` |
| Client secret do Entra | B | Entra ID (admin) |

O certificado da CA interna (para validar o LDAPS) **não** é segredo, mas fica no repositório privado porque identifica a empresa.

| Ambiente | Onde ficam os segredos |
|---|---|
| Local | `.env` na raiz e chaves em pasta listada no `.gitignore` |
| Homologação e produção | Variáveis de ambiente do serviço Windows, com ACL restrita à conta do serviço |

**Regras:**

- O `.env.example` lista **só os nomes** das variáveis.
- O serviço não sobe se faltar variável obrigatória (E1-03).
- Segredo vazado: trocar na origem **primeiro**, depois investigar.
- Data de troca de cada segredo registrada no runbook, com lembrete 30 dias antes.

---

## 9. Versionamento e release

### 9.1 Versão semântica (SemVer)

| Parte | Quando sobe | Exemplo |
|---|---|---|
| **MAIOR** | Remove ou muda cabeçalho do contrato, ou quebra o InfraPrint | `1.0.0 → 2.0.0` |
| **MENOR** | Funcionalidade nova compatível (ex.: login Entra na fase B) | `1.0.0 → 1.1.0` |
| **CORREÇÃO** | Bug ou ajuste de segurança compatível | `1.1.0 → 1.1.1` |

Antes da primeira produção, usar `0.x.y`. A `1.0.0` marca o InfraPrint em produção com login AD (fim da fase A).

### 9.2 Passos da release

1. Conferir que as histórias da sprint estão Done em homologação.
2. Atualizar o `CHANGELOG.md`.
3. Criar a tag (`git tag v0.3.0`) e enviar ao GitHub.
4. Executar o roteiro de segurança manual em homologação.
5. Abrir chamado no Agidesk pedindo aprovação do Bruno, com o CHANGELOG.
6. Após aprovação, implantar em produção (seção 10).
7. Registrar no chamado: versão, data e resultado dos testes pós-deploy.

---

## 10. Implantação e rollback no Tickway

### 10.1 Estrutura de pastas no servidor

```text
D:\Apps\infra-auth\
├── releases\
│   ├── v0.2.0\
│   └── v0.3.0\        # versão nova
├── current\           # junction para a release ativa
├── keys\              # chaves do JWT, ACL só para a conta do serviço
├── data\              # SQLite com hash dos refresh tokens
└── logs\
```

### 10.2 Implantação

1. Copiar a release para `releases\vX.Y.Z` e rodar `npm ci --omit=dev`.
2. Parar o serviço Windows.
3. Apontar `current` para a nova pasta.
4. Iniciar o serviço e conferir `GET /health`.
5. Testar um login real no AD, um acesso negado (403) e um logout.

### 10.3 Rollback

1. Parar o serviço.
2. Apontar `current` de volta para a release anterior.
3. Iniciar o serviço e repetir o teste de login.
4. Registrar o motivo no chamado do Agidesk e abrir um `fix/`.

Manter sempre **as duas últimas releases** no servidor. Apagar versões antigas só após confirmação.

Se a release mudou o formato do JWT, os usuários logados precisarão entrar de novo após o rollback. Avisar antes.

---

## 11. Rotina de trabalho solo

### 11.1 Planning poker para uma pessoa

- Estimar comparando com as âncoras (`/health` = 1, middleware de validação do JWT = 3).
- Registrar no backlog o estimado e, ao final, como foi de verdade (menor, igual, maior).
- Na dúvida entre duas cartas, escolher a maior. Hesitação é incerteza.
- História que daria 13: quebrar antes de começar.

### 11.2 Cadência (sprints de 2 semanas)

| Momento | Duração | O que fazer |
|---|---|---|
| Início da sprint | 30 min | Escolher histórias até a velocidade média |
| Diário | 5 min | Anotar: o que fiz, o que farei, o que está travando |
| Fim da sprint: review | 30 min | Mostrar ao Bruno o que funciona em homologação |
| Fim da sprint: retrospectiva | 15 min | Uma coisa a manter, uma a mudar |
| Semanal | 15 min | `npm audit`, `npm outdated`, alertas do Dependabot (`ldapts`, `jose`, MSAL) |

### 11.3 Registro de decisões (ADR)

Toda decisão técnica relevante vira um arquivo curto em `docs/decisoes/`:

- `001-login-ad-via-ldaps.md`
- `002-jwt-curto-com-refresh-opaco.md`
- `003-repositorio-publico-config-privada.md`
- `004-entra-id-como-fase-b.md`

Formato: contexto, decisão, alternativas descartadas, consequências. Sem dados internos da empresa, porque o repositório é público.

---

## 12. Quando escalar para o Bruno

- Conta de serviço do AD nova ou mudança de permissão.
- App Registration novo ou mudança de permissão no Entra (fase B).
- Toda release para produção.
- Suspeita de vazamento de segredo.
- Ativação do login de contingência em produção.
- Velocidade indica que o prazo de 3 meses do InfraPrint não cabe.
- Mudança que quebre o contrato de cabeçalhos (versão MAIOR).

---

## 13. Próximo passo

Criar o repositório no GitHub com as configurações da seção 3.3 e a estrutura da seção 4, e fazer o primeiro commit `chore: estrutura inicial`.
