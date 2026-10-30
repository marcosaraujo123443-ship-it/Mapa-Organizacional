/**
 * Matriz RACI de uma lista de atividades.
 * Cada cargo citado é clicável para navegar até ele no organograma.
 */
import type { Atividade, CargoRef } from '../types';
import { NomeEditavel } from './Edicao';

const PAPEIS = [
  { k: 'R', nome: 'Responsável', cor: 'bg-blue-600 text-white' },
  { k: 'A', nome: 'Aprovador',   cor: 'bg-emerald-600 text-white' },
  { k: 'C', nome: 'Consultado',  cor: 'bg-amber-400 text-amber-950' },
  { k: 'I', nome: 'Informado',   cor: 'bg-slate-300 text-slate-800' },
] as const;

function Chips({ cargos, onCargo, atualId }: { cargos: CargoRef[]; onCargo: (id: number) => void; atualId: number }) {
  if (!cargos.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {cargos.map((c) => (
        <button
          key={c.id}
          onClick={() => onCargo(c.id)}
          className={`rounded-md px-2 py-0.5 text-xs ring-1 ring-slate-200 hover:bg-blue-50 ${c.id === atualId ? 'bg-blue-50 font-semibold' : 'bg-white'}`}
        >
          {c.titulo}
        </button>
      ))}
    </div>
  );
}

interface Props {
  atividade: Atividade;
  cargoAtualId: number;
  focada?: boolean;
  onCargo: (id: number) => void;
  onPop: (popId: number) => void;
  onRenomear?: (novoNome: string) => Promise<void>;   // presente = nome editável
}

export function AtividadeRaci({ atividade: a, cargoAtualId, focada, onCargo, onPop, onRenomear }: Props) {
  const linhas: Record<(typeof PAPEIS)[number]['k'], CargoRef[]> = {
    R: a.raci.responsavel ? [a.raci.responsavel] : [],
    A: a.raci.aprovador ? [a.raci.aprovador] : [],
    C: a.raci.consultados,
    I: a.raci.informados,
  };
  return (
    <div
      id={`atividade-${a.id}`}
      className={`rounded-xl border bg-white p-3 ${focada ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-slate-200'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
          {onRenomear ? <NomeEditavel valor={a.nome} onSalvar={onRenomear} /> : a.nome}
        </h4>
        {a.tempo_estimado && (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600" title="Tempo estimado">
            ⏱ {a.tempo_estimado.slice(0, 5)}
          </span>
        )}
      </div>

      <dl className="space-y-1.5">
        {PAPEIS.map((p) => (
          <div key={p.k} className="grid grid-cols-[auto_1fr] items-start gap-2">
            <dt title={p.nome} className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${p.cor}`}>{p.k}</dt>
            <dd><Chips cargos={linhas[p.k]} onCargo={onCargo} atualId={cargoAtualId} /></dd>
          </div>
        ))}
      </dl>

      {a.pops.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          {a.pops.map((pop) => (
            <button
              key={pop.id}
              onClick={() => onPop(pop.id)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
            >
              📋 {pop.codigo_pop} <span className="text-blue-500">v{pop.versao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LegendaRaci() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
      {PAPEIS.map((p) => (
        <span key={p.k} className="flex items-center gap-1">
          <span className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${p.cor}`}>{p.k}</span>
          {p.nome}
        </span>
      ))}
    </div>
  );
}
