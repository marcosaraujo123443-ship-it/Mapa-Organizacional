/**
 * Barra de busca global (cargos, entregáveis, atividades e POPs).
 * - Debounce de 250 ms e cancelamento da requisição anterior.
 * - Destaque do termo nos resultados (insensível a acentos).
 * - Teclado: "/" foca, ↑/↓ navegam, Enter abre, Esc fecha.
 * - Informa ao pai os cargos encontrados para destacá-los no organograma.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ResultadoBusca } from '../types';
import { Highlight } from './Highlight';

/** Remove marcações Markdown do trecho para exibição limpa. */
const limparMd = (s: string) => s.replace(/[*#>`|]+/g, '').replace(/\s+/g, ' ').trim();

const TIPO: Record<ResultadoBusca['tipo'], { rotulo: string; cor: string }> = {
  cargo:      { rotulo: 'Cargo',      cor: 'bg-blue-100 text-blue-800' },
  entregavel: { rotulo: 'Entregável', cor: 'bg-violet-100 text-violet-800' },
  atividade:  { rotulo: 'Atividade',  cor: 'bg-emerald-100 text-emerald-800' },
  pop:        { rotulo: 'POP',        cor: 'bg-amber-100 text-amber-800' },
};

interface Props {
  empresaId?: number;                  // limita a busca à filial aberta
  onSelect: (r: ResultadoBusca) => void;
  onResultados: (cargoIds: Set<number>) => void;
}

export function SearchBar({ empresaId, onSelect, onResultados }: Props) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ResultadoBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho "/" para focar a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setRes([]);
      onResultados(new Set());
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCarregando(true);
      api.busca(termo, ctrl.signal, empresaId)
        .then(({ resultados }) => {
          setRes(resultados);
          setAtivo(0);
          onResultados(new Set(resultados.map((r) => r.cargo_id)));
        })
        .catch(() => { /* abortada ou offline */ })
        .finally(() => setCarregando(false));
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, onResultados, empresaId]);

  const escolher = (r: ResultadoBusca) => {
    setAberto(false);
    inputRef.current?.blur();
    onSelect(r);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, res.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && res[ativo]) escolher(res[ativo]);
    else if (e.key === 'Escape') { setQ(''); setAberto(false); }
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500">
        <span className="text-slate-400">🔍</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={onKeyDown}
          type="search"
          enterKeyHint="search"
          placeholder="Buscar cargo, KPI, atividade ou POP…  ( / )"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {carregando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />}
      </div>

      {aberto && q.trim().length >= 2 && (
        <ul className="absolute z-50 mt-2 max-h-[60dvh] w-full overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          {res.length === 0 && !carregando && <li className="p-3 text-sm text-slate-500">Nenhum resultado para “{q}”.</li>}
          {res.map((r, i) => (
            <li key={`${r.tipo}-${r.id}`}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(r)}
                onMouseEnter={() => setAtivo(i)}
                className={`w-full rounded-lg p-2.5 text-left ${i === ativo ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TIPO[r.tipo].cor}`}>
                    {TIPO[r.tipo].rotulo}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-900"><Highlight texto={r.titulo} termo={q} /></span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500"><Highlight texto={r.contexto} termo={q} /></p>
                {r.trecho && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">…<Highlight texto={limparMd(r.trecho)} termo={q} />…</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
