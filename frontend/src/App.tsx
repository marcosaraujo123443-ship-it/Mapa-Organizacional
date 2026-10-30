/**
 * Layout principal: árvore do grupo em tela cheia + busca no topo + gaveta de drill-down.
 * Navegação por cliques:
 *   Grupo › Empresas › Áreas › Funções (cargos) › gaveta: Entregáveis › Atividades (RACI) › POP (modal)
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { api } from './api/client';
import type { Departamento, Empresa, Organograma, OrgNode, ResultadoBusca } from './types';
import { OrgChart, type Abertos } from './components/OrgChart';
import { SearchBar } from './components/SearchBar';
import { CargoDrawer, type Aba } from './components/CargoDrawer';
import { CargoForm } from './components/CargoForm';
import { AreaForm } from './components/AreaForm';

// O modal do POP (com o renderizador de Markdown) só é baixado quando aberto
const PopModal = lazy(() => import('./components/PopModal').then((m) => ({ default: m.PopModal })));

interface Selecao { cargoId: number; aba: Aba; atividadeId: number | null }
interface FormCargo { empresaId: number; cargo?: OrgNode; departamentoInicial?: number; departamentos: Departamento[] }
interface FormArea { empresaId: number; area?: Departamento & { qtdCargos: number } }

/** Cria uma cópia do conjunto com `v` incluído (ou removido, se `remover`). */
const comItem = <T,>(s: Set<T>, v: T, remover = false) => {
  const n = new Set(s);
  if (remover) n.delete(v); else n.add(v);
  return n;
};

export default function App() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [organogramas, setOrganogramas] = useState<Map<number, Organograma>>(new Map());
  const [carregando, setCarregando] = useState<Set<number>>(new Set());
  const [abertos, setAbertos] = useState<Abertos>({ grupos: new Set(), empresas: new Set(), areas: new Set() });
  const [foco, setFoco] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [popId, setPopId] = useState<number | null>(null);
  const [destaques, setDestaques] = useState<Set<number>>(new Set());
  const [online, setOnline] = useState(navigator.onLine);
  const [formCargo, setFormCargo] = useState<FormCargo | null>(null);
  const [formArea, setFormArea] = useState<FormArea | null>(null);
  const [versaoDados, setVersaoDados] = useState(0);
  const ultimaEmpresa = useRef<number | null>(null);   // para o botão "+ Adicionar cargo"

  const carregarEmpresas = useCallback(
    () => api.empresas().then(setEmpresas).catch((e) => setErro(String(e.message ?? e))),
    [],
  );

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /** Busca (ou recarrega) o organograma de uma empresa. */
  const carregarOrganograma = useCallback(async (empresaId: number) => {
    setCarregando((s) => comItem(s, empresaId));
    try {
      const org = await api.organograma(empresaId);
      setOrganogramas((m) => new Map(m).set(empresaId, org));
      return org;
    } catch (e) {
      setErro(String((e as Error).message ?? e));
      return null;
    } finally {
      setCarregando((s) => comItem(s, empresaId, true));
    }
  }, []);

  // Em qual empresa está cada cargo já carregado
  const empresaDoCargo = useMemo(() => {
    const m = new Map<number, number>();
    organogramas.forEach((org, eid) => org.nodes.forEach((n) => m.set(n.id, eid)));
    return m;
  }, [organogramas]);

  const empresaSel = sel ? empresaDoCargo.get(sel.cargoId) ?? null : null;
  const recarregarTudo = useCallback(() => {
    if (empresaSel) carregarOrganograma(empresaSel);
    carregarEmpresas();
  }, [empresaSel, carregarOrganograma, carregarEmpresas]);

  // --- abrir/fechar níveis ---------------------------------------------------
  const toggleGrupo = useCallback((nome: string) => {
    setAbertos((a) => ({ ...a, grupos: comItem(a.grupos, nome, a.grupos.has(nome)) }));
    setFoco(`g:${nome}`);
  }, []);

  const toggleEmpresa = useCallback((id: number) => {
    ultimaEmpresa.current = id;
    setAbertos((a) => ({ ...a, empresas: comItem(a.empresas, id, a.empresas.has(id)) }));
    if (!organogramas.has(id)) carregarOrganograma(id);
    setFoco(`e:${id}`);
  }, [organogramas, carregarOrganograma]);

  const toggleArea = useCallback((id: number) => {
    setAbertos((a) => ({ ...a, areas: comItem(a.areas, id, a.areas.has(id)) }));
    setFoco(`a:${id}`);
  }, []);

  /** Abre grupo › empresa › área até o cargo e seleciona-o (usado pela busca e pelos links da gaveta). */
  const revelarCargo = useCallback(async (cargoId: number, aba: Aba = 'geral', atividadeId: number | null = null) => {
    setSel({ cargoId, aba, atividadeId });
    let empresaId = empresaDoCargo.get(cargoId);
    let deptoId = empresaId ? organogramas.get(empresaId)?.nodes.find((n) => n.id === cargoId)?.departamento_id : undefined;
    if (!empresaId || !deptoId) {
      const h = await api.hierarquia(cargoId).catch(() => null);
      if (!h) return;
      empresaId = h.empresa.id;
      deptoId = h.departamento.id;
      if (!organogramas.has(empresaId)) await carregarOrganograma(empresaId);
    }
    const grupo = empresas.find((e) => e.id === empresaId)?.grupo;
    ultimaEmpresa.current = empresaId;
    setAbertos((a) => ({
      grupos: grupo ? comItem(a.grupos, grupo) : a.grupos,
      empresas: comItem(a.empresas, empresaId!),
      areas: comItem(a.areas, deptoId!),
    }));
    setFoco(`c:${cargoId}`);
  }, [empresaDoCargo, organogramas, empresas, carregarOrganograma]);

  const selecionarCargo = useCallback((id: number) => {
    setSel({ cargoId: id, aba: 'geral', atividadeId: null });
    setFoco(`c:${id}`);
  }, []);

  // Resultado da busca → abre a árvore até o cargo e a gaveta na camada certa
  const onBuscaSelect = useCallback((r: ResultadoBusca) => {
    const aba: Aba = r.tipo === 'cargo' ? 'geral' : r.tipo === 'entregavel' ? 'entregaveis' : 'atividades';
    revelarCargo(r.cargo_id, aba, r.atividade_id);
    setPopId(r.tipo === 'pop' ? r.id : null);
  }, [revelarCargo]);

  // --- formulário de cargo ---------------------------------------------------
  const abrirFormCargo = useCallback(async (empresaId: number, extra: Partial<FormCargo> = {}) => {
    if (!organogramas.has(empresaId)) await carregarOrganograma(empresaId);
    const departamentos = await api.departamentos(empresaId).catch(() => []);
    setFormCargo({ empresaId, departamentos, ...extra });
  }, [organogramas, carregarOrganograma]);

  const novoCargoNaArea = useCallback((empresaId: number, departamentoId: number) => {
    abrirFormCargo(empresaId, { departamentoInicial: departamentoId });
  }, [abrirFormCargo]);

  // --- formulário de área ----------------------------------------------------
  const novaArea = useCallback((empresaId: number) => setFormArea({ empresaId }), []);

  const editarArea = useCallback((empresaId: number, departamentoId: number) => {
    const org = organogramas.get(empresaId);
    const nome = org?.departamentos?.find((d) => d.id === departamentoId)?.nome
      ?? org?.nodes.find((n) => n.departamento_id === departamentoId)?.departamento ?? '';
    const qtdCargos = org?.nodes.filter((n) => n.departamento_id === departamentoId).length ?? 0;
    setFormArea({ empresaId, area: { id: departamentoId, nome, qtdCargos } });
  }, [organogramas]);

  /** Depois de criar/editar/excluir área: recarrega a empresa e mantém-na aberta. */
  const aposArea = async (empresaId: number, abrirArea?: number) => {
    setFormArea(null);
    await carregarOrganograma(empresaId);
    carregarEmpresas();
    setVersaoDados((v) => v + 1);
    const grupo = empresas.find((e) => e.id === empresaId)?.grupo;
    setAbertos((a) => ({
      grupos: grupo ? comItem(a.grupos, grupo) : a.grupos,
      empresas: comItem(a.empresas, empresaId),
      areas: abrirArea ? comItem(a.areas, abrirArea) : a.areas,
    }));
    setFoco(abrirArea ? `a:${abrirArea}` : `e:${empresaId}`);
  };

  const novoCargo = () => {
    const id = empresaSel ?? ultimaEmpresa.current ?? empresas[0]?.id;
    if (id) abrirFormCargo(id);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="z-20 flex flex-col gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur
                         pt-[max(0.5rem,env(safe-area-inset-top))] md:flex-row md:items-center md:gap-4 md:px-4">
        <div className="flex items-center gap-2">
          <img src="/icons/icon.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-slate-900">Mapa Organizacional</h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">Toque para abrir: grupo › empresas › áreas › funções</p>
          </div>
          {/* No celular o botão fica compacto, na linha do logo */}
          <button onClick={novoCargo} className="ml-auto h-9 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white md:hidden">
            + Cargo
          </button>
        </div>
        <SearchBar onSelect={onBuscaSelect} onResultados={setDestaques} />
        <button
          onClick={novoCargo}
          className="hidden h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 md:block"
        >
          + Adicionar cargo
        </button>
        {!online && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
            Offline · exibindo dados salvos
          </span>
        )}
      </header>

      <main className="relative flex-1">
        {erro && <p className="absolute inset-x-4 top-4 z-10 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar: {erro}</p>}
        {empresas.length > 0 && (
          <ReactFlowProvider>
            <OrgChart
              empresas={empresas}
              organogramas={organogramas}
              carregando={carregando}
              abertos={abertos}
              selecionadoId={sel?.cargoId ?? null}
              destaqueIds={destaques}
              foco={foco}
              onToggleGrupo={toggleGrupo}
              onToggleEmpresa={toggleEmpresa}
              onToggleArea={toggleArea}
              onSelectCargo={selecionarCargo}
              onNovoCargo={novoCargoNaArea}
              onNovaArea={novaArea}
              onEditarArea={editarArea}
            />
          </ReactFlowProvider>
        )}
      </main>

      {sel && (
        <CargoDrawer
          cargoId={sel.cargoId}
          abaInicial={sel.aba}
          atividadeFoco={sel.atividadeId}
          onClose={() => setSel(null)}
          onNavegarCargo={(id) => revelarCargo(id)}
          onAbrirPop={setPopId}
          cargos={(empresaSel && organogramas.get(empresaSel)?.nodes) || []}
          versaoDados={versaoDados}
          onEditarCargo={(id) => {
            const eid = empresaDoCargo.get(id);
            const cargo = eid ? organogramas.get(eid)?.nodes.find((n) => n.id === id) : undefined;
            if (eid && cargo) abrirFormCargo(eid, { cargo });
          }}
          onAlterado={recarregarTudo}
          onCargoExcluido={() => { setSel(null); setPopId(null); recarregarTudo(); }}
        />
      )}
      {formCargo && (
        <CargoForm
          cargo={formCargo.cargo}
          departamentoInicial={formCargo.departamentoInicial}
          cargos={organogramas.get(formCargo.empresaId)?.nodes ?? []}
          departamentos={formCargo.departamentos}
          onClose={() => setFormCargo(null)}
          onSalvo={async (id) => {
            const eid = formCargo.empresaId;
            setFormCargo(null);
            const org = await carregarOrganograma(eid);
            carregarEmpresas();
            setVersaoDados((v) => v + 1);
            const depto = org?.nodes.find((n) => n.id === id)?.departamento_id;
            const grupo = empresas.find((e) => e.id === eid)?.grupo;
            if (depto) {
              setAbertos((a) => ({
                grupos: grupo ? comItem(a.grupos, grupo) : a.grupos,
                empresas: comItem(a.empresas, eid),
                areas: comItem(a.areas, depto),
              }));
            }
            selecionarCargo(id);
          }}
        />
      )}
      {formArea && (
        <AreaForm
          empresaId={formArea.empresaId}
          empresaNome={empresas.find((e) => e.id === formArea.empresaId)?.nome ?? ''}
          area={formArea.area}
          outrasAreas={(organogramas.get(formArea.empresaId)?.departamentos ?? []).filter((d) => d.id !== formArea.area?.id)}
          onClose={() => setFormArea(null)}
          onSalvo={(id) => aposArea(formArea.empresaId, id)}
          onExcluido={() => {
            if (sel && organogramas.get(formArea.empresaId)?.nodes.some((n) => n.id === sel.cargoId && n.departamento_id === formArea.area?.id)) setSel(null);
            aposArea(formArea.empresaId);
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
