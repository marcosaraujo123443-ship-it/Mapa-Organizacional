/**
 * Ponto de entrada da API REST.
 *   GET /api/v1/empresas                     -> empresas/filiais para o seletor
 *   GET /api/v1/organograma?empresa_id=1     -> nós e arestas para o React Flow
 *   GET /api/v1/cargos/:id/hierarquia        -> árvore completa Cargo > Entregável > Atividade > POP
 *   GET /api/v1/pops/:id                     -> POP individual
 *   GET /api/v1/busca?q=termo[&empresa_id=1] -> busca global (ou só de uma filial)
 *   POST/PATCH/DELETE /api/v1/departamentos | /cargos | /entregaveis | /atividades  -> criar, editar e excluir
 *     (DELETE de departamento com cargos: ?mover_para=ID ou ?excluir_cargos=1)
 *   GET /api/v1/departamentos?empresa_id=1   -> lista para formulários
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { router } from './routes/index.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1', router);

// Tratador de erros centralizado
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));
