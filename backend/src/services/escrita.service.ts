/**
 * Operações de escrita: criar e editar cargos, entregáveis e funções (atividades).
 * Os campos aceitos em cada tabela são fixos (lista branca), então nenhum nome de
 * coluna vem do cliente direto para o SQL.
 */
import { pool } from '../db/pool.js';

export class ErroValidacao extends Error {}

export const NIVEIS = ['operacional', 'tecnico', 'supervisao', 'coordenacao', 'gerencia', 'diretoria'] as const;
export const FREQUENCIAS = ['diaria', 'semanal', 'quinzenal', 'mensal', 'trimestral', 'semestral', 'anual', 'sob_demanda'] as const;

type Campo = { tipo: 'texto'; max: number; obrigatorio?: boolean }
  | { tipo: 'id'; obrigatorio?: boolean }
  | { tipo: 'enum'; valores: readonly string[] }
  | { tipo: 'intervalo' }
  | { tipo: 'inteiro' }
  | { tipo: 'ids' };

const ESQUEMAS: Record<'cargos' | 'entregaveis' | 'atividades', Record<string, Campo>> = {
  cargos: {
    departamento_id: { tipo: 'id', obrigatorio: true },
    titulo: { tipo: 'texto', max: 150, obrigatorio: true },
    cbo: { tipo: 'texto', max: 10 },
    nivel: { tipo: 'enum', valores: NIVEIS },
    cargo_superior_id: { tipo: 'id' },
    quadro: { tipo: 'inteiro' },
  },
  entregaveis: {
    cargo_id: { tipo: 'id', obrigatorio: true },
    titulo: { tipo: 'texto', max: 200, obrigatorio: true },
    kpi_meta: { tipo: 'texto', max: 300 },
    frequencia: { tipo: 'enum', valores: FREQUENCIAS },
  },
  atividades: {
    entregavel_id: { tipo: 'id', obrigatorio: true },
    nome: { tipo: 'texto', max: 200, obrigatorio: true },
    tempo_estimado: { tipo: 'intervalo' },
    raci_responsavel_id: { tipo: 'id' },
    raci_aprovador_id: { tipo: 'id' },
    raci_consultado: { tipo: 'ids' },
    raci_informado: { tipo: 'ids' },
  },
};

/** Valida o corpo da requisição. Em edição (parcial) nenhum campo é obrigatório. */
function validar(tabela: keyof typeof ESQUEMAS, corpo: Record<string, unknown>, parcial: boolean) {
  const esquema = ESQUEMAS[tabela];
  const saida: Record<string, unknown> = {};
  for (const [nome, c] of Object.entries(esquema)) {
    if (!(nome in corpo)) {
      if (!parcial && 'obrigatorio' in c && c.obrigatorio) throw new ErroValidacao(`Campo obrigatório: ${nome}`);
      continue;
    }
    let v = corpo[nome];
    if (v === '' || v === undefined) v = null;
    if (v === null) {
      if ('obrigatorio' in c && c.obrigatorio) throw new ErroValidacao(`Campo obrigatório: ${nome}`);
      saida[nome] = c.tipo === 'ids' ? [] : null;
      continue;
    }
    switch (c.tipo) {
      case 'texto':
        if (typeof v !== 'string' || !v.trim()) throw new ErroValidacao(`${nome} deve ser um texto`);
        if (v.trim().length > c.max) throw new ErroValidacao(`${nome} aceita até ${c.max} caracteres`);
        v = v.trim();
        break;
      case 'id':
        if (!Number.isInteger(v) || (v as number) <= 0) throw new ErroValidacao(`${nome} inválido`);
        break;
      case 'enum':
        if (!c.valores.includes(v as string)) throw new ErroValidacao(`${nome} deve ser um de: ${c.valores.join(', ')}`);
        break;
      case 'intervalo':
        if (typeof v !== 'string' || !/^\d{1,3}:[0-5]\d(:[0-5]\d)?$/.test(v)) throw new ErroValidacao(`${nome} deve estar no formato HH:MM`);
        break;
      case 'inteiro':
        if (!Number.isInteger(v) || (v as number) < 0) throw new ErroValidacao(`${nome} deve ser um número inteiro ≥ 0`);
        break;
      case 'ids':
        if (!Array.isArray(v) || !v.every((x) => Number.isInteger(x) && x > 0)) throw new ErroValidacao(`${nome} deve ser uma lista de ids`);
        break;
    }
    saida[nome] = v;
  }
  if (!Object.keys(saida).length) throw new ErroValidacao('Nenhum campo para salvar');
  return saida;
}

/** Converte erros do Postgres (FK, unicidade, check) em mensagens para o usuário. */
function traduzir(e: unknown): never {
  const err = e as { code?: string; constraint?: string };
  if (err.code === '23503') throw new ErroValidacao('Registro relacionado não existe (verifique departamento, cargo ou entregável).');
  if (err.code === '23505') throw new ErroValidacao('Já existe um registro com esses dados.');
  if (err.code === '23514') throw new ErroValidacao('Valor não permitido (um cargo não pode ser superior de si mesmo).');
  throw e;
}

export async function criar(tabela: keyof typeof ESQUEMAS, corpo: Record<string, unknown>) {
  const dados = validar(tabela, corpo, false);
  const cols = Object.keys(dados);
  const sql = `INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
  try {
    const { rows } = await pool.query(sql, Object.values(dados));
    return rows[0];
  } catch (e) { traduzir(e); }
}

export async function editar(tabela: keyof typeof ESQUEMAS, id: number, corpo: Record<string, unknown>) {
  const dados = validar(tabela, corpo, true);
  if (tabela === 'cargos' && dados.cargo_superior_id) await impedirCiclo(id, dados.cargo_superior_id as number);
  const cols = Object.keys(dados);
  const sql = `UPDATE ${tabela} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, [...Object.values(dados), id]);
    return rows[0] ?? null;
  } catch (e) { traduzir(e); }
}

/** Impede que um cargo passe a reportar para um dos próprios subordinados. */
async function impedirCiclo(cargoId: number, novoSuperiorId: number) {
  const { rows } = await pool.query(
    `WITH RECURSIVE sub AS (
       SELECT id FROM cargos WHERE id = $1
       UNION SELECT c.id FROM cargos c JOIN sub ON c.cargo_superior_id = sub.id
     ) SELECT 1 FROM sub WHERE id = $2`,
    [cargoId, novoSuperiorId],
  );
  if (rows.length) throw new ErroValidacao('O superior escolhido é subordinado deste cargo.');
}

export async function listarDepartamentos(empresaId: number) {
  const { rows } = await pool.query('SELECT id, nome FROM departamentos WHERE empresa_id = $1 ORDER BY nome', [empresaId]);
  return rows;
}

/**
 * Exclusões. Entregáveis, funções e POPs dependentes saem junto (ON DELETE CASCADE).
 * Ao excluir um cargo:
 *  - seus subordinados passam a reportar para o superior dele (o organograma não "quebra");
 *  - ele é removido das listas de Consultado/Informado das funções de outros cargos
 *    (R e A já viram NULL pela FK ON DELETE SET NULL).
 */
export async function excluir(tabela: keyof typeof ESQUEMAS, id: number): Promise<boolean> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    if (tabela === 'cargos') {
      await cliente.query(
        `UPDATE cargos SET cargo_superior_id = (SELECT cargo_superior_id FROM cargos WHERE id = $1)
          WHERE cargo_superior_id = $1`,
        [id],
      );
      await cliente.query(
        `UPDATE atividades
            SET raci_consultado = array_remove(raci_consultado, $1),
                raci_informado  = array_remove(raci_informado, $1)
          WHERE $1 = ANY(raci_consultado) OR $1 = ANY(raci_informado)`,
        [id],
      );
    }
    const { rowCount } = await cliente.query(`DELETE FROM ${tabela} WHERE id = $1`, [id]);
    await cliente.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}
