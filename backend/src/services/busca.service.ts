/**
 * Busca global em cargos, entregáveis, atividades e POPs.
 * - Insensível a acentos e maiúsculas (f_unaccent + ILIKE, acelerado por índices GIN trigram).
 * - Cada resultado traz o cargo_id "dono" para o frontend abrir o drawer no ponto certo.
 * - O destaque (highlight) do termo é feito no frontend; aqui devolvemos um trecho (snippet).
 */
import { pool } from '../db/pool.js';

export type TipoResultado = 'cargo' | 'entregavel' | 'atividade' | 'pop';

export interface ResultadoBusca {
  tipo: TipoResultado;
  id: number;
  titulo: string;
  contexto: string;      // ex: "Logística › Conferente de Estoque"
  trecho: string | null; // parte do conteúdo onde o termo aparece (POPs)
  cargo_id: number;
  atividade_id: number | null;
  score: number;
}

const SQL_BUSCA = `
WITH termo AS (SELECT f_unaccent($1) AS t, '%' || f_unaccent($1) || '%' AS padrao)
SELECT * FROM (
  SELECT 'cargo' AS tipo, c.id, c.titulo, d.nome AS contexto, NULL AS trecho,
         c.id AS cargo_id, NULL::int AS atividade_id,
         similarity(f_unaccent(c.titulo), termo.t) + 0.3 AS score
    FROM cargos c JOIN departamentos d ON d.id = c.departamento_id, termo
   WHERE f_unaccent(c.titulo) ILIKE termo.padrao OR c.cbo ILIKE termo.padrao

  UNION ALL
  SELECT 'entregavel', en.id, en.titulo, d.nome || ' › ' || c.titulo,
         en.kpi_meta, c.id, NULL,
         similarity(f_unaccent(en.titulo), termo.t) + 0.2
    FROM entregaveis en
    JOIN cargos c ON c.id = en.cargo_id
    JOIN departamentos d ON d.id = c.departamento_id, termo
   WHERE f_unaccent(en.titulo) ILIKE termo.padrao OR f_unaccent(coalesce(en.kpi_meta,'')) ILIKE termo.padrao

  UNION ALL
  SELECT 'atividade', a.id, a.nome, c.titulo || ' › ' || en.titulo,
         NULL, c.id, a.id,
         similarity(f_unaccent(a.nome), termo.t) + 0.1
    FROM atividades a
    JOIN entregaveis en ON en.id = a.entregavel_id
    JOIN cargos c ON c.id = en.cargo_id, termo
   WHERE f_unaccent(a.nome) ILIKE termo.padrao

  UNION ALL
  SELECT 'pop', p.id, p.codigo_pop || ' · ' || p.titulo, c.titulo || ' › ' || a.nome,
         -- trecho de ~140 caracteres ao redor da primeira ocorrência
         CASE WHEN strpos(f_unaccent(lower(p.conteudo_markdown)), lower(termo.t)) > 0
              THEN substr(p.conteudo_markdown,
                          greatest(strpos(f_unaccent(lower(p.conteudo_markdown)), lower(termo.t)) - 60, 1), 140)
         END,
         c.id, a.id,
         similarity(f_unaccent(p.titulo), termo.t)
    FROM pops_passo_a_passo p
    JOIN atividades a ON a.id = p.atividade_id
    JOIN entregaveis en ON en.id = a.entregavel_id
    JOIN cargos c ON c.id = en.cargo_id, termo
   WHERE f_unaccent(p.titulo) ILIKE termo.padrao
      OR f_unaccent(p.conteudo_markdown) ILIKE termo.padrao
      OR p.codigo_pop ILIKE termo.padrao
      OR f_unaccent(p.checklist_json::text) ILIKE termo.padrao
) r
ORDER BY score DESC, titulo
LIMIT $2;
`;

export async function buscar(q: string, limite: number): Promise<ResultadoBusca[]> {
  // Escapa curingas do LIKE digitados pelo usuário
  const termo = q.replace(/[\\%_]/g, (m) => '\\' + m);
  const { rows } = await pool.query(SQL_BUSCA, [termo, limite]);
  return rows;
}
