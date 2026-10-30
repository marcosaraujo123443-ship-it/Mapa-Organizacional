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
Banco criado antes das colunas `cargos.quadro` e `empresas.grupo`? Rode também `database/03_quadro.sql`.

## Importar as filiais da planilha de quadro de pessoal

```bash
pip install openpyxl
python scripts/importar_quadro.py QUADRO.xlsx > database/04_filiais.sql
psql -d mapeamento -f database/04_filiais.sql
```

O script cria uma **empresa por filial**, todas no grupo informado (padrão `"Grupo JC"`, que é a raiz da árvore no app), (a lista vem da aba `FILIAIS`) e, dentro de cada uma, os departamentos e os cargos, com a quantidade de pessoas (`quadro`) e a quem cada cargo reporta. O superior é descoberto pelas colunas *líder imediato / gerente 1 / gerente 2*. Quando a planilha não indica ninguém da mesma filial, o cargo passa a reportar ao gestor do próprio departamento. As regras que decidem em qual filial cada linha entra ficam no topo do script, em `REGRAS_SECAO`, `REGRAS_PALAVRA` e `REGRAS_CODIGO`.

O SQL gerado **não tem dados pessoais** (nomes, nascimento, idade, sexo). Mesmo assim, a planilha e o `04_filiais.sql` estão no `.gitignore`: a estrutura da empresa não deve ir para um repositório público.
O schema usa as extensões `pg_trgm` e `unaccent` (vêm no pacote padrão do PostgreSQL).

## Endpoints (`/api/v1`)

| Método | Rota                         | Descrição |
|--------|------------------------------|-----------|
| GET    | `/empresas`                  | Empresas/filiais com grupo, total de cargos e de pessoas (níveis de cima da árvore) |
| GET    | `/organograma?empresa_id=1`  | Nós (cargos) e arestas (`cargo_superior_id`) para o React Flow |
| GET    | `/cargos/{id}/hierarquia`    | Árvore completa do cargo: empresa, departamento, cadeia de superiores (CTE recursiva), subordinados (CTE recursiva), entregáveis → atividades com RACI resolvida → POPs, e participações do cargo na RACI de outros cargos |
| GET    | `/pops/{id}`                 | POP completo (markdown, checklist, anexos) |
| GET    | `/busca?q={termo}&limite=30&empresa_id=` | Busca global (com `empresa_id`, só naquela filial) em cargos, entregáveis/KPIs, atividades e POPs (sem acento, sem maiúsculas, com trecho do POP onde o termo aparece) |
| GET    | `/departamentos?empresa_id=1`| Lista de departamentos (usada nos formulários) |
| POST   | `/cargos`                    | Cria cargo: `{ departamento_id, titulo, nivel, cbo?, cargo_superior_id?, quadro? }` |
| PATCH  | `/cargos/{id}`               | Edita qualquer campo acima. Bloqueia reportar para um subordinado (ciclo) |
| POST   | `/entregaveis`               | Cria entregável: `{ cargo_id, titulo, frequencia, kpi_meta? }` |
| PATCH  | `/entregaveis/{id}`          | Edita entregável |
| POST   | `/atividades`                | Cria função: `{ entregavel_id, nome, tempo_estimado?: "HH:MM", raci_responsavel_id?, raci_aprovador_id?, raci_consultado?: [ids], raci_informado?: [ids] }` |
| PATCH  | `/atividades/{id}`           | Edita função (ex.: `{ "nome": "Novo nome" }`) |
| DELETE | `/atividades/{id}`           | Exclui a função e os POPs dela |
| DELETE | `/entregaveis/{id}`          | Exclui o entregável, suas funções e POPs |
| DELETE | `/cargos/{id}`               | Exclui o cargo com entregáveis, funções e POPs. A equipe direta passa a reportar para o superior dele, e o cargo sai das listas de Consultado/Informado |

Erros de validação voltam como `400 { "erro": "mensagem" }`.

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

- `components/OrgChart.tsx`: organograma em **árvore que abre por cliques**, da esquerda para a direita (React Flow + dagre): **Grupo › Empresas › Áreas › Funções (cargos)**. Só os níveis abertos são desenhados, e cada empresa é carregada da API quando é aberta. Dentro de uma área, os cargos seguem a hierarquia entre eles. A busca abre a árvore até o cargo encontrado.
- `components/TreeNodes.tsx`: cards do grupo, da empresa e da área, com totais de pessoas e funções. O "+" da área cria um cargo direto nela.
- `components/CargoCard.tsx`: nó customizado (departamento, título, nível, CBO, qtd. de KPIs).
- `components/CargoDrawer.tsx`: gaveta de drill-down com as abas *Visão geral*, *Entregáveis*, *Atividades (RACI)* e *Participações*. No desktop fica à direita, com o organograma navegável ao fundo; no celular vira um *bottom sheet*.
- `components/RaciTable.tsx`: cartão de atividade com R/A/C/I. Cada cargo citado é clicável e navega até ele.
- `components/PopModal.tsx`: passo a passo em Markdown (com tabelas), checklist interativo com progresso salvo no aparelho e anexos. É carregado sob demanda.
- `components/CargoForm.tsx`: modal para **adicionar** ou **editar** um cargo (nome, departamento, nível, CBO e a quem reporta). Aberto pelo botão "+ Adicionar cargo" no topo ou por "✎ Editar" no drawer.
- `components/Edicao.tsx`: formulários dentro do drawer para **adicionar função** (atividade, com R e A), **renomear função** (ícone ✎ ao lado do nome), **adicionar entregável** e **excluir** cargo, entregável ou função (🗑, com confirmação que diz o que será apagado junto).
- `components/SearchBar.tsx`: busca com debounce, destaque do termo e navegação por teclado (`/` foca a busca). Ao escolher um resultado, o drawer abre direto na camada certa (cargo, entregável, atividade ou POP).

## PWA

- `public/manifest.json`: instalável no Android, iOS e desktop (ícones normais e *maskable*).
- `public/service-worker.js`: pré-cache do app shell, assets com cache-first, API com network-first e cache de reserva (organograma, cargos e POPs já abertos funcionam offline) e busca apenas online.
- O SW só é registrado no build de produção: `npm run build && npm run preview` em `frontend/` para testar a instalação.
- Para publicar uma nova versão, altere `VERSAO` no service worker.

## Próximos passos sugeridos

1. Autenticação (JWT/SSO) e multiempresa (filtrar por `empresa_id` do usuário).
2. Edição de POPs e da matriz C/I pela interface; lixeira/histórico para desfazer exclusões.
3. Upload de anexos (S3/MinIO) e histórico/aprovação de versões de POP.
4. Busca full-text com `tsvector` (dicionário `portuguese`) quando o volume de POPs crescer.
