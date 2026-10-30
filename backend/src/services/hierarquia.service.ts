/**
 * Consultas hierárquicas.
 * A árvore Cargo > Entregáveis > Atividades (RACI) > POPs é montada inteiramente
 * no PostgreSQL com json_build_object/json_agg: 1 ida ao banco por requisição.
 */
import { pool } from '../db/pool.js';

/** Resolve uma lista de ids de cargos em [{id, titulo}] preservando a ordem. */
const cargosDoArray = (col: string) => `
  COALESCE((
    SELECT json_agg(json_build_object('id', c.id, 'titulo', c.titulo) ORDER BY u.ord)
    FROM unnest(${col}) WITH ORDINALITY AS u(cid, ord)
    JOIN cargos c ON c.id = u.cid
  ), '[]'::json)`;

const cargoRef = (col: string) => `
  (SELECT json_build_object('id', c.id, 'titulo', c.titulo) FROM cargos c WHERE c.id = ${col})`;

/** Objeto JSON de uma atividade com a matriz RACI resolvida e seus POPs. */
const atividadeJson = (alias: string) => `
  json_build_object(
    'id', ${alias}.id,
    'nome', ${alias}.nome,
    'tempo_estimado', ${alias}.tempo_estimado,
    'raci', json_build_object(
      'responsavel', ${cargoRef(`${alias}.raci_responsavel_id`)},
      'aprovador',   ${cargoRef(`${alias}.raci_aprovador_id`)},
      'consultados', ${cargosDoArray(`${alias}.raci_consultado`)},
      'informados',  ${cargosDoArray(`${alias}.raci_informado`)}
    ),
    'pops', COALESCE((
      SELECT json_agg(json_build_object(
               'id', p.id, 'codigo_pop', p.codigo_pop, 'versao', p.versao,
               'titulo', p.titulo, 'data_atualizacao', p.data_atualizacao
             ) ORDER BY p.codigo_pop)
      FROM pops_passo_a_passo p WHERE p.atividade_id = ${alias}.id
    ), '[]'::json)
  )`;

const SQL_HIERARQUIA = `
WITH RECURSIVE
-- Cadeia de comando para cima (do cargo até o topo)
superiores AS (
  SELECT c.id, c.titulo, c.cargo_superior_id, 0 AS dist
  FROM cargos c WHERE c.id = $1
  UNION ALL
  SELECT p.id, p.titulo, p.cargo_superior_id, s.dist + 1
  FROM cargos p JOIN superiores s ON p.id = s.cargo_superior_id
  WHERE s.dist < 50                                   -- proteção contra ciclos
),
-- Todos os subordinados (diretos e indiretos)
subordinados AS (
  SELECT c.id, c.titulo, c.nivel, c.cargo_superior_id, 1 AS profundidade
  FROM cargos c WHERE c.cargo_superior_id = $1
  UNION ALL
  SELECT c.id, c.titulo, c.nivel, c.cargo_superior_id, s.profundidade + 1
  FROM cargos c JOIN subordinados s ON c.cargo_superior_id = s.id
  WHERE s.profundidade < 50
)
SELECT json_build_object(
  'id', c.id,
  'titulo', c.titulo,
  'cbo', c.cbo,
  'nivel', c.nivel,
  'quadro', c.quadro,
  'empresa', json_build_object('id', e.id, 'nome', e.nome, 'cnpj', e.cnpj),
  'departamento', json_build_object('id', d.id, 'nome', d.nome),
  'cadeia_superiores', COALESCE((
     SELECT json_agg(json_build_object('id', s.id, 'titulo', s.titulo) ORDER BY s.dist DESC)
     FROM superiores s WHERE s.dist > 0
  ), '[]'::json),
  'subordinados', COALESCE((
     SELECT json_agg(json_build_object(
              'id', s.id, 'titulo', s.titulo, 'nivel', s.nivel,
              'cargo_superior_id', s.cargo_superior_id, 'profundidade', s.profundidade
            ) ORDER BY s.profundidade, s.titulo)
     FROM subordinados s
  ), '[]'::json),
  'entregaveis', COALESCE((
     SELECT json_agg(json_build_object(
              'id', en.id, 'titulo', en.titulo, 'kpi_meta', en.kpi_meta, 'frequencia', en.frequencia,
              'atividades', COALESCE((
                 SELECT json_agg(${atividadeJson('a')} ORDER BY a.id)
                 FROM atividades a WHERE a.entregavel_id = en.id
              ), '[]'::json)
            ) ORDER BY en.id)
     FROM entregaveis en WHERE en.cargo_id = c.id
  ), '[]'::json),
  -- Atividades de OUTROS cargos em que este cargo aparece na RACI
  'participacoes_raci', COALESCE((
     SELECT json_agg(json_build_object(
              'papel', CASE WHEN a.raci_responsavel_id = c.id THEN 'R'
                            WHEN a.raci_aprovador_id   = c.id THEN 'A'
                            WHEN c.id = ANY(a.raci_consultado) THEN 'C'
                            ELSE 'I' END,
              'atividade', ${atividadeJson('a')},
              'dono', json_build_object('id', dono.id, 'titulo', dono.titulo)
            ) ORDER BY a.id)
     FROM atividades a
     JOIN entregaveis en2 ON en2.id = a.entregavel_id
     JOIN cargos dono     ON dono.id = en2.cargo_id
     WHERE en2.cargo_id <> c.id
       AND (a.raci_responsavel_id = c.id OR a.raci_aprovador_id = c.id
            OR c.id = ANY(a.raci_consultado) OR c.id = ANY(a.raci_informado))
  ), '[]'::json)
) AS arvore
FROM cargos c
JOIN departamentos d ON d.id = c.departamento_id
JOIN empresas e      ON e.id = d.empresa_id
WHERE c.id = $1;
`;

export async function getHierarquiaCargo(cargoId: number) {
  const { rows } = await pool.query(SQL_HIERARQUIA, [cargoId]);
  return rows[0]?.arvore ?? null;
}

/** Nós (cargos) e arestas (cargo_superior_id) para desenhar o organograma. */
export async function getOrganograma(empresaId: number) {
  const { rows } = await pool.query(
    `SELECT c.id, c.titulo, c.cbo, c.nivel, c.cargo_superior_id, c.quadro,
            d.id AS departamento_id, d.nome AS departamento,
            (d.gestor_cargo_id = c.id) AS gestor_departamento,
            (SELECT count(*)::int FROM entregaveis en WHERE en.cargo_id = c.id) AS qtd_entregaveis
       FROM cargos c
       JOIN departamentos d ON d.id = c.departamento_id
      WHERE d.empresa_id = $1
      ORDER BY c.id`,
    [empresaId],
  );
  return {
    nodes: rows,
    edges: rows
      .filter((r) => r.cargo_superior_id)
      .map((r) => ({ id: `e${r.cargo_superior_id}-${r.id}`, source: String(r.cargo_superior_id), target: String(r.id) })),
  };
}

/** Empresas/filiais com totais, para o seletor do app. */
export async function getEmpresas() {
  const { rows } = await pool.query(
    `SELECT e.id, e.nome,
            count(c.id)::int AS qtd_cargos,
            coalesce(sum(c.quadro), 0)::int AS quadro
       FROM empresas e
       LEFT JOIN departamentos d ON d.empresa_id = e.id
       LEFT JOIN cargos c ON c.departamento_id = d.id
      GROUP BY e.id
      ORDER BY e.id`,
  );
  return rows;
}

export async function getPop(popId: number) {
  const { rows } = await pool.query(
    `SELECT p.*, a.nome AS atividade_nome, a.entregavel_id
       FROM pops_passo_a_passo p
       JOIN atividades a ON a.id = p.atividade_id
      WHERE p.id = $1`,
    [popId],
  );
  return rows[0] ?? null;
}
