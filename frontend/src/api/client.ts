/** Cliente HTTP mínimo da API. Em produção, defina VITE_API_URL (ex: https://api.suaempresa.com). */
import type {
  Atividade, CargoRef, Departamento, Entregavel, HierarquiaCargo, NovaAtividade, NovoCargo, NovoEntregavel,
  Organograma, Pop, ResultadoBusca,
} from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal });
  if (!res.ok) throw new Error(`Erro ${res.status} em ${path}`);
  return res.json();
}

/** POST/PATCH com JSON. Repassa a mensagem de erro de validação da API. */
async function enviar<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.erro ?? `Erro ${res.status} ao salvar`);
  return json;
}

export const api = {
  organograma: (empresaId = 1) => get<Organograma>(`/organograma?empresa_id=${empresaId}`),
  hierarquia: (cargoId: number) => get<HierarquiaCargo>(`/cargos/${cargoId}/hierarquia`),
  pop: (popId: number) => get<Pop>(`/pops/${popId}`),
  busca: (q: string, signal?: AbortSignal) =>
    get<{ q: string; resultados: ResultadoBusca[] }>(`/busca?q=${encodeURIComponent(q)}`, signal),
  departamentos: (empresaId = 1) => get<Departamento[]>(`/departamentos?empresa_id=${empresaId}`),

  criarCargo: (c: NovoCargo) => enviar<CargoRef>('POST', '/cargos', c),
  editarCargo: (id: number, c: Partial<NovoCargo>) => enviar<CargoRef>('PATCH', `/cargos/${id}`, c),
  criarEntregavel: (e: NovoEntregavel) => enviar<Pick<Entregavel, 'id' | 'titulo'>>('POST', '/entregaveis', e),
  criarAtividade: (a: NovaAtividade) => enviar<Pick<Atividade, 'id' | 'nome'>>('POST', '/atividades', a),
  editarAtividade: (id: number, a: Partial<NovaAtividade>) => enviar<Pick<Atividade, 'id' | 'nome'>>('PATCH', `/atividades/${id}`, a),
};
