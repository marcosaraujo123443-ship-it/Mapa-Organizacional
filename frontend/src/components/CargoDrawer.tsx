/**
 * Gaveta lateral (drill-down) do cargo selecionado.
 * - Desktop: painel à direita; o organograma continua visível e navegável ao fundo.
 * - Mobile: "bottom sheet" ocupando ~85% da altura.
 * Abas: Visão geral · Entregáveis/KPIs · Atividades (RACI) · Participações.
 * Também permite editar o cargo, adicionar entregáveis e adicionar/renomear funções.
 */
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CargoRef, HierarquiaCargo } from '../types';
import { BotaoAdicionar, FREQUENCIAS, NovaFuncaoForm, NovoEntregavelForm } from './Edicao';
import { NIVEL } from './nivel';
import { AtividadeRaci, LegendaRaci } from './RaciTable';

export type Aba = 'geral' | 'entregaveis' | 'atividades' | 'participacoes';

const ABAS: { k: Aba; rotulo: string }[] = [
  { k: 'geral', rotulo: 'Visão geral' },
  { k: 'entregaveis', rotulo: 'Entregáveis' },
  { k: 'atividades', rotulo: 'Atividades (RACI)' },
  { k: 'participacoes', rotulo: 'Participações' },
];


interface Props {
  cargoId: number;
  abaInicial?: Aba;
  atividadeFoco?: number | null;   // vindo da busca: rola até a atividade
  onClose: () => void;
  onNavegarCargo: (id: number) => void;
  onAbrirPop: (popId: number) => void;
  cargos: CargoRef[];               // opções de R/A ao adicionar função
  versaoDados: number;              // muda quando o organograma é alterado fora do drawer
  onEditarCargo: (id: number) => void;
  onAlterado: () => void;           // avisa o App para recarregar o organograma
}

export function CargoDrawer({
  cargoId, abaInicial = 'geral', atividadeFoco, onClose, onNavegarCargo, onAbrirPop,
  cargos, versaoDados, onEditarCargo, onAlterado,
}: Props) {
  const [dados, setDados] = useState<HierarquiaCargo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [recarga, setRecarga] = useState(0);
  const [novaFuncaoEm, setNovaFuncaoEm] = useState<number | null>(null); // id do entregável
  const [novoEntregavel, setNovoEntregavel] = useState(false);

  useEffect(() => {
    setAba(abaInicial);
    setNovaFuncaoEm(null);
    setNovoEntregavel(false);
  }, [abaInicial, cargoId]);

  useEffect(() => {
    let ativo = true;
    // Só mostra o "carregando" ao trocar de cargo; ao recarregar o mesmo cargo mantém a tela
    setDados((d) => (d?.id === cargoId ? d : null));
    setErro(null);
    api.hierarquia(cargoId).then((d) => ativo && setDados(d)).catch((e) => ativo && setErro(String(e.message ?? e)));
    return () => { ativo = false; };
  }, [cargoId, recarga, versaoDados]);

  /** Depois de salvar: recarrega o drawer e o organograma. */
  const aposSalvar = () => {
    setRecarga((n) => n + 1);
    onAlterado();
  };

  const criarFuncao = (entregavelId: number) => async (f: Parameters<Parameters<typeof NovaFuncaoForm>[0]['onCriar']>[0]) => {
    await api.criarAtividade({ entregavel_id: entregavelId, ...f });
    setNovaFuncaoEm(null);
    aposSalvar();
  };

  const renomearFuncao = (atividadeId: number) => async (nome: string) => {
    await api.editarAtividade(atividadeId, { nome });
    aposSalvar();
  };

  // Rola até a atividade destacada pela busca
  useEffect(() => {
    if (dados && atividadeFoco && aba === 'atividades') {
      document.getElementById(`atividade-${atividadeFoco}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [dados, atividadeFoco, aba]);

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const atividades = dados?.entregaveis.flatMap((e) => e.atividades.map((a) => ({ a, entregavel: e.titulo }))) ?? [];

  return (
    <>
      {/* Fundo escurecido apenas no mobile (no desktop o organograma segue interativo) */}
      <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} />

      <aside
        role="dialog"
        aria-label="Detalhes do cargo"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col rounded-t-2xl bg-slate-50 shadow-2xl
                   md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[480px] md:rounded-none md:border-l md:border-slate-200"
      >
        {/* "Puxador" visual do bottom sheet */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300 md:hidden" />

        {/* Cabeçalho */}
        <header className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* Breadcrumb: Empresa › Departamento › cadeia de superiores */}
              <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                {dados && (
                  <>
                    <span>{dados.empresa.nome}</span><span>›</span>
                    <span>{dados.departamento.nome}</span>
                  </>
                )}
              </nav>
              <h2 className="mt-0.5 text-lg font-bold leading-tight text-slate-900">{dados?.titulo ?? 'Carregando…'}</h2>
              {dados && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${NIVEL[dados.nivel].badge}`}>{NIVEL[dados.nivel].rotulo}</span>
                  {dados.cbo && <span className="text-slate-500">CBO {dados.cbo}</span>}
                </div>
              )}
            </div>
            {dados && (
              <button onClick={() => onEditarCargo(dados.id)} className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                ✎ Editar
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
          </div>

          {/* Abas (rolagem horizontal no mobile) */}
          <div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
            {ABAS.map((t) => (
              <button
                key={t.k}
                onClick={() => setAba(t.k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${aba === t.k ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        </header>

        {/* Conteúdo */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          {!dados && !erro && <div className="h-24 animate-pulse rounded-xl bg-slate-200" />}

          {dados && aba === 'geral' && (
            <>
              <section className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Linha de reporte</h3>
                {dados.cadeia_superiores.length === 0 && <p className="text-sm text-slate-500">Topo da hierarquia.</p>}
                <ol className="space-y-1">
                  {dados.cadeia_superiores.map((s, i) => (
                    <li key={s.id} style={{ paddingLeft: i * 12 }}>
                      <button onClick={() => onNavegarCargo(s.id)} className="text-sm text-blue-700 hover:underline">↑ {s.titulo}</button>
                    </li>
                  ))}
                  <li style={{ paddingLeft: dados.cadeia_superiores.length * 12 }} className="text-sm font-semibold">● {dados.titulo}</li>
                </ol>
              </section>

              <section className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Equipe ({dados.subordinados.length})</h3>
                {dados.subordinados.length === 0 && <p className="text-sm text-slate-500">Sem subordinados.</p>}
                <ul className="space-y-1">
                  {dados.subordinados.map((s) => (
                    <li key={s.id} style={{ paddingLeft: (s.profundidade - 1) * 12 }}>
                      <button onClick={() => onNavegarCargo(s.id)} className="text-sm text-blue-700 hover:underline">↓ {s.titulo}</button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Entregáveis', dados.entregaveis.length],
                  ['Atividades', atividades.length],
                  ['POPs', atividades.reduce((n, x) => n + x.a.pops.length, 0)],
                ].map(([r, v]) => (
                  <div key={r} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-2xl font-bold text-slate-900">{v}</p>
                    <p className="text-[11px] text-slate-500">{r}</p>
                  </div>
                ))}
              </section>
            </>
          )}

          {dados && aba === 'entregaveis' && (
            <>
              {dados.entregaveis.length === 0 && <p className="text-sm text-slate-500">Nenhum entregável cadastrado.</p>}
              {dados.entregaveis.map((e) => (
                <article key={e.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{e.titulo}</h4>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                      {FREQUENCIAS[e.frequencia] ?? e.frequencia}
                    </span>
                  </div>
                  {e.kpi_meta && (
                    <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">🎯 {e.kpi_meta}</p>
                  )}
                  <button
                    onClick={() => setAba('atividades')}
                    className="mt-2 text-xs font-medium text-blue-700 hover:underline"
                  >
                    {e.atividades.length} função(ões) →
                  </button>
                </article>
              ))}
              {novoEntregavel ? (
                <NovoEntregavelForm
                  onCancelar={() => setNovoEntregavel(false)}
                  onCriar={async (e) => {
                    await api.criarEntregavel({ cargo_id: dados.id, ...e });
                    setNovoEntregavel(false);
                    aposSalvar();
                  }}
                />
              ) : (
                <BotaoAdicionar rotulo="Adicionar entregável" onClick={() => setNovoEntregavel(true)} />
              )}
            </>
          )}

          {dados && aba === 'atividades' && (
            <>
              <LegendaRaci />
              {dados.entregaveis.map((e) => (
                <section key={e.id} className="space-y-2">
                  <h3 className="pt-1 text-xs font-semibold uppercase text-slate-500">{e.titulo}</h3>
                  {e.atividades.map((a) => (
                    <AtividadeRaci
                      key={a.id}
                      atividade={a}
                      cargoAtualId={dados.id}
                      focada={a.id === atividadeFoco}
                      onCargo={onNavegarCargo}
                      onPop={onAbrirPop}
                      onRenomear={renomearFuncao(a.id)}
                    />
                  ))}
                  {novaFuncaoEm === e.id ? (
                    <NovaFuncaoForm
                      cargoAtual={dados}
                      superior={dados.cadeia_superiores.at(-1) ?? null}
                      cargos={cargos}
                      onCriar={criarFuncao(e.id)}
                      onCancelar={() => setNovaFuncaoEm(null)}
                    />
                  ) : (
                    <BotaoAdicionar rotulo="Adicionar função" onClick={() => setNovaFuncaoEm(e.id)} />
                  )}
                </section>
              ))}
              {dados.entregaveis.length === 0 && (
                <div className="space-y-2 rounded-xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                  <p>As funções ficam dentro de um entregável. Crie o primeiro entregável deste cargo para começar.</p>
                  <button
                    onClick={() => { setAba('entregaveis'); setNovoEntregavel(true); }}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    + Adicionar entregável
                  </button>
                </div>
              )}
            </>
          )}

          {dados && aba === 'participacoes' && (
            <>
              <p className="text-xs text-slate-500">Atividades de outros cargos em que <b>{dados.titulo}</b> aparece na RACI.</p>
              {dados.participacoes_raci.map((p) => (
                <div key={p.atividade.id} className="space-y-1">
                  <p className="text-[11px] text-slate-500">
                    Papel <b>{p.papel}</b> · dono:{' '}
                    <button onClick={() => onNavegarCargo(p.dono.id)} className="text-blue-700 hover:underline">{p.dono.titulo}</button>
                  </p>
                  <AtividadeRaci
                    atividade={p.atividade}
                    cargoAtualId={dados.id}
                    focada={p.atividade.id === atividadeFoco}
                    onCargo={onNavegarCargo}
                    onPop={onAbrirPop}
                  />
                </div>
              ))}
              {dados.participacoes_raci.length === 0 && <p className="text-sm text-slate-500">Nenhuma participação.</p>}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
