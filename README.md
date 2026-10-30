# Mapa Organizacional (Cargos, Entregáveis e Processos)

Plataforma web/PWA para navegar do organograma até a instrução operacional:

```
Empresa › Departamento › Cargo › Entregáveis/KPIs › Atividades (RACI) › POP (passo a passo)
```

| Pasta       | Conteúdo                                                                  |
|-------------|---------------------------------------------------------------------------|
| `database/` | `01_schema.sql` (tabelas, FKs, índices, restrições) e `02_seed.sql` (fluxo fictício de Logística/Recebimento) |
| `backend/`  | API REST em Node.js + TypeScript + Express + `pg`                         |
| `frontend/` | React + Vite + Tailwind + React Flow (organograma), drawer, modal de POP e PWA |

## Como rodar (≈ 3 minutos)

Pré-requisitos: Node 20+ e Docker (ou um PostgreSQL 13+ local).

```bash
# 1) Banco (cria tabelas e carrega os dados de exemplo automaticamente)
docker compose up -d

# 2) API -> http://localhost:3333
cd backend
cp .env.example .env
npm install
npm run dev

# 3) Frontend -> http://localhost:5173 (em outro terminal)
cd frontend
npm install
npm run dev
```

Sem Docker: `psql -d mapeamento -f database/01_schema.sql -f database/02_seed.sql`.
O schema usa as extensões `pg_trgm` e `unaccent` (vêm no pacote padrão do PostgreSQL).

## Endpoints (`/api/v1`)

| Método | Rota                         | Descrição |
|--------|------------------------------|-----------|
| GET    | `/organograma?empresa_id=1`  | Nós (cargos) e arestas (`cargo_superior_id`) para o React Flow |
| GET    | `/cargos/{id}/hierarquia`    | Árvore completa do cargo: empresa, departamento, cadeia de superiores (CTE recursiva), subordinados (CTE recursiva), entregáveis → atividades com RACI resolvida → POPs, e participações do cargo na RACI de outros cargos |
| GET    | `/pops/{id}`                 | POP completo (markdown, checklist, anexos) |
| GET    | `/busca?q={termo}&limite=30` | Busca global em cargos, entregáveis/KPIs, atividades e POPs (sem acento, sem maiúsculas, com trecho do POP onde o termo aparece) |

Exemplos com os dados fictícios:

```bash
curl localhost:3333/api/v1/cargos/4/hierarquia     # Conferente de Estoque
curl "localhost:3333/api/v1/busca?q=divergencia"
```

## Decisões de modelagem

- **RACI**: `raci_responsavel_id` e `raci_aprovador_id` são FKs para `cargos` (R e A são únicos por definição). `raci_consultado` e `raci_informado` são `INT[]` com índice GIN, pois são listas; a API devolve os nomes dos cargos já resolvidos.
- **POP**: `checklist_json` e `anexos_json` em `JSONB` (validados como array). `(codigo_pop, versao)` é único, para manter histórico de versões. `data_atualizacao` é atualizada por trigger.
- **Busca**: índices GIN trigram sobre `f_unaccent(...)` deixam o `ILIKE '%termo%'` rápido mesmo com milhares de POPs.
- **Hierarquia**: a árvore é montada no próprio PostgreSQL (`json_build_object`/`json_agg`), em uma única consulta por requisição. As CTEs recursivas têm limite de profundidade para se proteger de ciclos.
- **Dependência circular** `departamentos.gestor_cargo_id ↔ cargos.departamento_id`: a FK do gestor é criada depois da tabela `cargos`.

## Frontend

- `components/OrgChart.tsx`: organograma com layout automático em árvore (dagre). Cards clicáveis; resultados da busca ficam destacados e o restante esmaecido.
- `components/CargoCard.tsx`: nó customizado (departamento, título, nível, CBO, qtd. de KPIs).
- `components/CargoDrawer.tsx`: gaveta de drill-down com as abas *Visão geral*, *Entregáveis*, *Atividades (RACI)* e *Participações*. No desktop fica à direita, com o organograma navegável ao fundo; no celular vira um *bottom sheet*.
- `components/RaciTable.tsx`: cartão de atividade com R/A/C/I. Cada cargo citado é clicável e navega até ele.
- `components/PopModal.tsx`: passo a passo em Markdown (com tabelas), checklist interativo com progresso salvo no aparelho e anexos. É carregado sob demanda.
- `components/SearchBar.tsx`: busca com debounce, destaque do termo e navegação por teclado (`/` foca a busca). Ao escolher um resultado, o drawer abre direto na camada certa (cargo, entregável, atividade ou POP).

## PWA

- `public/manifest.json`: instalável no Android, iOS e desktop (ícones normais e *maskable*).
- `public/service-worker.js`: pré-cache do app shell, assets com cache-first, API com network-first e cache de reserva (organograma, cargos e POPs já abertos funcionam offline) e busca apenas online.
- O SW só é registrado no build de produção: `npm run build && npm run preview` em `frontend/` para testar a instalação.
- Para publicar uma nova versão, altere `VERSAO` no service worker.

## Próximos passos sugeridos

1. Autenticação (JWT/SSO) e multiempresa (filtrar por `empresa_id` do usuário).
2. CRUD de cargos, entregáveis, atividades e POPs (rotas POST/PUT/DELETE com validação via `zod`).
3. Upload de anexos (S3/MinIO) e histórico/aprovação de versões de POP.
4. Busca full-text com `tsvector` (dicionário `portuguese`) quando o volume de POPs crescer.
