/**
 * Layout principal: organograma em tela cheia + busca no topo + drawer de drill-down.
 * Fluxo de navegação (5 camadas):
 *   Empresa/Departamento (cards) → Cargo (drawer) → Entregáveis → Atividades (RACI) → POP (modal)
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { api } from './api/client';
import type { Departamento, Organograma, OrgNode, ResultadoBusca } from './types';
import { OrgChart } from './components/OrgChart';
import { SearchBar } from './components/SearchBar';
import { CargoDrawer, type Aba } from './components/CargoDrawer';
import { CargoForm } from './components/CargoForm';

// O modal do POP (com o renderizador de Markdown) só é baixado quando aberto
const PopModal = lazy(() => import('./components/PopModal').then((m) => ({ default: m.PopModal })));

interface Selecao { cargoId: number; aba: Aba; atividadeId: number | null }

export default function App() {
  const [org, setOrg] = useState<Organograma | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const [destaques, setDestaques] = useState<Set<number>>(new Set());
  const [online, setOnline] = useState(navigator.onLine);
  // Formulário de cargo aberto: { cargo } edita, { cargo: undefined } cria
  const [formCargo, setFormCargo] = useState<{ cargo?: OrgNode } | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [versaoDados, setVersaoDados] = useState(0);

  const carregarOrganograma = useCallback(
    () => api.organograma(1).then(setOrg).catch((e) => setErro(String(e.message ?? e))),
    [],
  );

  useEffect(() => {
    carregarOrganograma();
    api.departamentos(1).then(setDepartamentos).catch(() => { /* formulário mostra lista vazia */ });
  }, [carregarOrganograma]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const abrirCargo = useCallback((cargoId: number) => setSel({ cargoId, aba: 'geral', atividadeId: null }), []);

  // Resultado da busca → abre o drawer na camada certa (e o POP, se for o caso)
  const onBuscaSelect = useCallback((r: ResultadoBusca) => {
    const aba: Aba = r.tipo === 'cargo' ? 'geral' : r.tipo === 'entregavel' ? 'entregaveis' : 'atividades';
    setSel({ cargoId: r.cargo_id, aba, atividadeId: r.atividade_id });
    setPopId(r.tipo === 'pop' ? r.id : null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="z-20 flex flex-col gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur
                         pt-[max(0.5rem,env(safe-area-inset-top))] md:flex-row md:items-center md:gap-4 md:px-4">
        <div className="flex items-center gap-2">
          <img src="/icons/icon.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-slate-900">Mapa Organizacional</h1>
            <p className="text-[11px] text-slate-500">Cargos · Entregáveis · Processos · POPs</p>
          </div>
          {/* No celular o botão fica compacto, na linha do logo */}
          <button
            onClick={() => setFormCargo({})}
            className="ml-auto h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white md:hidden"
          >
            + Cargo
          </button>
        </div>
        <SearchBar onSelect={onBuscaSelect} onResultados={setDestaques} />
        <button
          onClick={() => setFormCargo({})}
          className="hidden h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 md:block"
        >
          + Adicionar cargo
        </button>
        {!online && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 md:ml-auto">
            Offline · exibindo dados salvos
          </span>
        )}
      </header>

      <main className="relative flex-1">
        {erro && <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar o organograma: {erro}</p>}
        {org && (
          <ReactFlowProvider>
            <OrgChart org={org} selecionadoId={sel?.cargoId ?? null} destaqueIds={destaques} onSelect={abrirCargo} />
          </ReactFlowProvider>
        )}
      </main>

      {sel && (
        <CargoDrawer
          cargoId={sel.cargoId}
          abaInicial={sel.aba}
          atividadeFoco={sel.atividadeId}
          onClose={() => setSel(null)}
          onNavegarCargo={abrirCargo}
          onAbrirPop={setPopId}
          cargos={org?.nodes ?? []}
          versaoDados={versaoDados}
          onEditarCargo={(id) => setFormCargo({ cargo: org?.nodes.find((n) => n.id === id) })}
          onAlterado={carregarOrganograma}
        />
      )}
      {formCargo && org && (
        <CargoForm
          cargo={formCargo.cargo}
          cargos={org.nodes}
          departamentos={departamentos}
          onClose={() => setFormCargo(null)}
          onSalvo={async (id) => {
            setFormCargo(null);
            await carregarOrganograma();
            setVersaoDados((v) => v + 1);
            abrirCargo(id);
          }}
        />
      )}
      {popId && (
        <Suspense fallback={null}>
          <PopModal popId={popId} onClose={() => setPopId(null)} />
        </Suspense>
      )}
    </div>
  );
}
