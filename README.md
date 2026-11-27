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
db/seed-demo.sql             dados de demonstração para avaliação
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

## Dados de demonstração (avaliação)

Para avaliar a aplicação com a base já povoada, o repositório traz o seed
[`db/seed-demo.sql`](db/seed-demo.sql), que cria a **Fazenda Santa Clara** com
dados coerentes em todos os módulos:

| Conteúdo | Quantidade |
|---|---|
| Piquetes | 5 (em uso, em recuperação, disponível e ofertado para aluguel) |
| Animais | 12 (novilhos, bois gordos e matrizes) |
| Lotes | 3 (Recria, Engorda e Matrizes) |
| Ocupações | 4 (duas em andamento, duas encerradas) |
| Movimentações | 3 |
| Medições de pasto | 4 |
| Tarefas da agenda | 5 (3 pendentes, 2 concluídas) |
| Alertas | 3 (um de cada tipo) |
| Oferta de aluguel | 1 publicada |

### Como povoar

```bash
# base local emulada (junto com npm run dev)
npx wrangler d1 execute pastoflux-production --local --file db/seed-demo.sql

# base de produção, visível em https://www.pastoflux.me
npx wrangler login
npx wrangler d1 execute pastoflux-production --remote --file db/seed-demo.sql
```

O script é reexecutável: ele remove a fazenda de demonstração antes de recriá-la,
então rodar mais de uma vez não duplica registros. Todos os identificadores ficam
na faixa `9001`–`9112`, fora da sequência usada pelos dados reais.

### Como acessar a fazenda de demonstração

Em `localhost` a fazenda aparece automaticamente (identidade `local-development`).
Na aplicação em produção, informe este **código de acesso** na tela de acesso:

```
11111111-2222-3333-4444-555555555555
```

### Como remover depois

```bash
npx wrangler d1 execute pastoflux-production --remote \
  --command "DELETE FROM farms WHERE id=9001; DELETE FROM user_farms WHERE farm_id=9001;"
```

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
