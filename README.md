# PastoFlux

Aplicação web responsiva para pequenos e médios pecuaristas acompanharem
**fazenda, áreas/piquetes, rebanho, lotes, ocupação e descanso das pastagens,
alertas, agenda de manejo e aluguel de pasto ocioso** — com dados persistentes
em Cloudflare D1 e separados por fazenda.

- **Aplicação em produção:** https://www.pastoflux.me
- **Disciplina:** Laboratório de Engenharia de Software
- **Integrante:** Lucas Gonçalves (desenvolvimento individual)
- **Documentação do projeto:** pasta [`documentacao/`](documentacao/) (persona e
  jornada, backlog, sprints, relatório final e apresentação)

## Funcionalidades

| Módulo | O que faz |
|---|---|
| Visão geral | Área total e mapeada, áreas cadastradas, tarefas pendentes e alertas de manejo |
| Fazenda | Cadastro, edição e troca da fazenda ativa |
| Rebanho | Animais individuais ou em lote (sexo, peso, categoria, piquete), lotes, movimentação entre áreas e indicadores |
| Pastagens | Tamanho e capacidade, status derivado por datas (disponível / em uso / em recuperação) e registro de disponibilidade |
| Simulador | Estimativa demonstrativa de dias até o remanejamento, com atalho que cria a atividade já preenchida na Agenda |
| Agenda | Criar, editar, concluir e reabrir tarefas; alertas convertidos em tarefas |
| Aluguel | Publicação de área livre com capacidade e R$/cabeça por faixa de peso, filtros, encerramento e contato liberado sob solicitação |
| Acesso | Código de acesso para usar em outro aparelho, isolamento por fazenda, perfis (owner/manager/viewer) e auditoria |

## Tecnologias

- **Linguagem:** TypeScript (e JavaScript nas funções de domínio)
- **Frontend:** React 19
- **Framework full-stack:** [vinext](https://github.com/cloudflare/vinext) (API do Next.js App Router sobre Vite 8)
- **Backend / hospedagem:** Cloudflare Workers
- **Banco de dados:** Cloudflare D1 (SQLite) com [Drizzle ORM](https://orm.drizzle.team/docs/get-started/d1-new)
- **Qualidade:** ESLint 9 (react, hooks, jsx-a11y) e testes com `node:test`
- **Deploy:** Wrangler CLI

## Estrutura

```
app/page.tsx                 interface (7 módulos)
app/api/**/route.ts          rotas REST
lib/api.ts                   cliente HTTP tipado + código de acesso
lib/server.ts                serviços, controle de acesso, auditoria, alertas
lib/domain-validation.js     validações e regras de negócio puras
lib/simulator.js             cálculo do simulador
db/schema.ts                 esquema Drizzle (14 tabelas)
drizzle/                     migrações SQL versionadas
worker/index.ts              entrada do Cloudflare Worker
tests/                       testes automatizados
wrangler.jsonc               Worker + binding do D1
```

## Como executar localmente

Pré-requisito: Node.js `>=22.13.0`.

```bash
npm install
npm run dev        # http://localhost:4173 com D1 local emulado
```

Em `localhost` o servidor usa a identidade `local-development`, sem necessidade de login.

## Validação

```bash
npm run lint       # análise estática
npm test           # build + testes de domínio e de renderização
npm run build      # build de produção
```

Após alterar `db/schema.ts`, gere a migração com `npm run db:generate`.

## Banco e deploy (Cloudflare)

O banco de produção é o D1 `pastoflux-production`, configurado em `wrangler.jsonc`
com o binding `DB`. Em uma máquina nova:

```bash
npx wrangler login
npx wrangler d1 migrations apply pastoflux-production --remote
npm run build
npx wrangler deploy
```

O Worker atende em https://www.pastoflux.me (domínio próprio) e em
`https://pastoflux.lucas-zapedus.workers.dev`.

Nunca versione tokens, senhas ou arquivos `.env`. O `database_id` do D1 em
`wrangler.jsonc` identifica o banco, mas não é um segredo de autenticação.

## Identidade e acesso

Cada navegador gera um **código de acesso** (UUID), guardado no `localStorage` e
enviado no cabeçalho `x-pastoflux-user-id`; a fazenda ativa vai em `x-farm-id`.
O servidor confere o vínculo usuário–fazenda e o perfil antes de qualquer leitura
ou escrita e registra as alterações em `audit_logs`. O código pode ser informado
em outro aparelho para acessar as mesmas fazendas. Ainda não há login com senha.

## Limitações conhecidas

- Fórmula do simulador ilustrativa, sem validação agronômica.
- Sem modo offline e sem notificações.
- O código de acesso funciona como senha: não há recuperação nem revogação.
