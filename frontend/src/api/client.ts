/** Cliente HTTP mínimo da API. Em produção, defina VITE_API_URL (ex: https://api.suaempresa.com). */
import type { HierarquiaCargo, Organograma, Pop, ResultadoBusca } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal });
  if (!res.ok) throw new Error(`Erro ${res.status} em ${path}`);
  return res.json();
}

export const api = {
  organograma: (empresaId = 1) => get<Organograma>(`/organograma?empresa_id=${empresaId}`),
  hierarquia: (cargoId: number) => get<HierarquiaCargo>(`/cargos/${cargoId}/hierarquia`),
  pop: (popId: number) => get<Pop>(`/pops/${popId}`),
  busca: (q: string, signal?: AbortSignal) =>
    get<{ q: string; resultados: ResultadoBusca[] }>(`/busca?q=${encodeURIComponent(q)}`, signal),
};
