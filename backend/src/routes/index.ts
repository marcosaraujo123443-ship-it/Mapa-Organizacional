import { Router, type Request, type Response, type NextFunction } from 'express';
import { getHierarquiaCargo, getOrganograma, getPop } from '../services/hierarquia.service.js';
import { buscar } from '../services/busca.service.js';
import { criar, editar, ErroValidacao, listarDepartamentos } from '../services/escrita.service.js';

export const router = Router();

/** Envolve handlers async para que erros caiam no middleware de erro. */
const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const idParam = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

router.get('/organograma', h(async (req, res) => {
  const empresaId = idParam(req.query.empresa_id ?? 1);
  if (!empresaId) return res.status(400).json({ erro: 'empresa_id inválido' });
  res.json(await getOrganograma(empresaId));
}));

router.get('/cargos/:id/hierarquia', h(async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  const arvore = await getHierarquiaCargo(id);
  if (!arvore) return res.status(404).json({ erro: 'Cargo não encontrado' });
  res.json(arvore);
}));

router.get('/pops/:id', h(async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  const pop = await getPop(id);
  if (!pop) return res.status(404).json({ erro: 'POP não encontrado' });
  res.json(pop);
}));

router.get('/busca', h(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.status(400).json({ erro: 'Informe ao menos 2 caracteres em q' });
  const limite = Math.min(Number(req.query.limite) || 30, 100);
  res.json({ q, resultados: await buscar(q, limite) });
}));

// ---------------------------------------------------------------------------
// Escrita: cargos, entregáveis e funções (atividades)
// ---------------------------------------------------------------------------

router.get('/departamentos', h(async (req, res) => {
  const empresaId = idParam(req.query.empresa_id ?? 1);
  if (!empresaId) return res.status(400).json({ erro: 'empresa_id inválido' });
  res.json(await listarDepartamentos(empresaId));
}));

const TABELAS = { cargos: 'cargos', entregaveis: 'entregaveis', atividades: 'atividades' } as const;

for (const [rota, tabela] of Object.entries(TABELAS)) {
  router.post(`/${rota}`, h(async (req, res) => {
    try {
      res.status(201).json(await criar(tabela, req.body ?? {}));
    } catch (e) {
      if (e instanceof ErroValidacao) return res.status(400).json({ erro: e.message });
      throw e;
    }
  }));

  router.patch(`/${rota}/:id`, h(async (req, res) => {
    const id = idParam(req.params.id);
    if (!id) return res.status(400).json({ erro: 'id inválido' });
    try {
      const salvo = await editar(tabela, id, req.body ?? {});
      if (!salvo) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json(salvo);
    } catch (e) {
      if (e instanceof ErroValidacao) return res.status(400).json({ erro: e.message });
      throw e;
    }
  }));
}
