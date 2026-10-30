/**
 * Pequenos formulários usados dentro do drawer:
 *  - NomeEditavel: renomear no próprio lugar (Enter salva, Esc cancela)
 *  - NovaFuncaoForm: adicionar uma função (atividade) a um entregável
 *  - NovoEntregavelForm: adicionar um entregável/KPI ao cargo
 *  - BotaoExcluir: excluir com confirmação no próprio lugar (o viewer não usa confirm())
 */
import { useState } from 'react';
import type { CargoRef } from '../types';

const campo = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const botaoPrimario = 'h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const botaoSecundario = 'h-10 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100';

/** Executa `acao`, controlando o estado de "salvando" e a mensagem de erro. */
function useSalvar() {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async (acao: () => Promise<void>) => {
    setSalvando(true);
    setErro(null);
    try { await acao(); } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  };
  return { salvando, erro, salvar };
}

export function BotaoAdicionar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
    >
      + {rotulo}
    </button>
  );
}

export function NomeEditavel({ valor, onSalvar, className = '' }: { valor: string; onSalvar: (novo: string) => Promise<void>; className?: string }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const { salvando, erro, salvar } = useSalvar();

  if (!editando) {
    return (
      <span className={`group inline-flex items-start gap-1 ${className}`}>
        <span>{valor}</span>
        <button
          onClick={() => { setTexto(valor); setEditando(true); }}
          title="Editar nome"
          aria-label="Editar nome"
          className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
        >
          ✎
        </button>
      </span>
    );
  }

  const confirmar = () => {
    const novo = texto.trim();
    if (!novo || novo === valor) return setEditando(false);
    salvar(async () => { await onSalvar(novo); setEditando(false); });
  };

  return (
    <span className="block w-full">
      <span className="flex gap-2">
        <input
          autoFocus
          value={texto}
          maxLength={200}
          disabled={salvando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); } }}
          className={campo}
        />
        <button onClick={confirmar} disabled={salvando} className={botaoPrimario}>OK</button>
      </span>
      {erro && <span className="mt-1 block text-xs text-red-600">{erro}</span>}
    </span>
  );
}

interface NovaFuncaoProps {
  cargoAtual: CargoRef;
  superior: CargoRef | null;
  cargos: CargoRef[];
  onCriar: (f: { nome: string; tempo_estimado: string | null; raci_responsavel_id: number | null; raci_aprovador_id: number | null }) => Promise<void>;
  onCancelar: () => void;
}

export function NovaFuncaoForm({ cargoAtual, superior, cargos, onCriar, onCancelar }: NovaFuncaoProps) {
  const [nome, setNome] = useState('');
  const [tempo, setTempo] = useState('');
  const [resp, setResp] = useState<number | ''>(cargoAtual.id);
  const [aprov, setAprov] = useState<number | ''>(superior?.id ?? '');
  const { salvando, erro, salvar } = useSalvar();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar(() => onCriar({
          nome,
          tempo_estimado: tempo || null,
          raci_responsavel_id: resp === '' ? null : resp,
          raci_aprovador_id: aprov === '' ? null : aprov,
        }));
      }}
      className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3"
    >
      <input id="funcao-nome" autoFocus required maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da função. Ex: Separação de pedidos" className={campo} />
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <label>
          Responsável (R)
          <select id="funcao-resp" value={resp} onChange={(e) => setResp(e.target.value ? Number(e.target.value) : '')} className={campo}>
            <option value="">—</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </label>
        <label>
          Aprovador (A)
          <select id="funcao-aprov" value={aprov} onChange={(e) => setAprov(e.target.value ? Number(e.target.value) : '')} className={campo}>
            <option value="">—</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs text-slate-600">
        Tempo estimado
        <input id="funcao-tempo" type="time" value={tempo} onChange={(e) => setTempo(e.target.value)} className={`${campo} max-w-[9rem]`} />
      </label>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={botaoSecundario}>Cancelar</button>
        <button disabled={salvando || !nome.trim()} className={botaoPrimario}>{salvando ? 'Salvando…' : 'Adicionar função'}</button>
      </div>
    </form>
  );
}

export const FREQUENCIAS: Record<string, string> = {
  diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', sob_demanda: 'Sob demanda',
};

interface NovoEntregavelProps {
  onCriar: (e: { titulo: string; kpi_meta: string | null; frequencia: string }) => Promise<void>;
  onCancelar: () => void;
}

export function NovoEntregavelForm({ onCriar, onCancelar }: NovoEntregavelProps) {
  const [titulo, setTitulo] = useState('');
  const [kpi, setKpi] = useState('');
  const [freq, setFreq] = useState('diaria');
  const { salvando, erro, salvar } = useSalvar();

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); salvar(() => onCriar({ titulo, kpi_meta: kpi || null, frequencia: freq })); }}
      className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3"
    >
      <input id="entregavel-titulo" autoFocus required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que o cargo entrega. Ex: Expedição no prazo" className={campo} />
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <input id="entregavel-kpi" maxLength={300} value={kpi} onChange={(e) => setKpi(e.target.value)} placeholder="Meta / KPI. Ex: OTIF ≥ 97%" className={campo} />
        <select id="entregavel-freq" value={freq} onChange={(e) => setFreq(e.target.value)} className={campo}>
          {Object.entries(FREQUENCIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={botaoSecundario}>Cancelar</button>
        <button disabled={salvando || !titulo.trim()} className={botaoPrimario}>{salvando ? 'Salvando…' : 'Adicionar entregável'}</button>
      </div>
    </form>
  );
}

interface ExcluirProps {
  rotulo: string;                 // ex: "Excluir função"
  aviso: string;                  // o que será apagado junto
  onExcluir: () => Promise<void>;
  compacto?: boolean;             // só o ícone, para dentro de cards
}

export function BotaoExcluir({ rotulo, aviso, onExcluir, compacto }: ExcluirProps) {
  const [confirmando, setConfirmando] = useState(false);
  const { salvando, erro, salvar } = useSalvar();

  if (!confirmando) {
    return compacto ? (
      <button onClick={() => setConfirmando(true)} title={rotulo} aria-label={rotulo} className="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
        🗑
      </button>
    ) : (
      <button onClick={() => setConfirmando(true)} className="h-10 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50">
        🗑 {rotulo}
      </button>
    );
  }

  return (
    <div role="alertdialog" className="mt-2 w-full space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p>{aviso}</p>
      {erro && <p className="text-xs">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => setConfirmando(false)} className={botaoSecundario}>Cancelar</button>
        <button
          autoFocus
          disabled={salvando}
          onClick={() => salvar(onExcluir)}
          className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {salvando ? 'Excluindo…' : 'Sim, excluir'}
        </button>
      </div>
    </div>
  );
}
