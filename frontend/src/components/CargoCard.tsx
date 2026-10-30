/**
 * Nó customizado do React Flow: card de um cargo no organograma.
 * Recebe em `data` o cargo + flags de seleção/destaque de busca.
 */
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { OrgNode } from '../types';
import { NIVEL } from './nivel';

export type CargoNodeData = OrgNode & { selecionado: boolean; destacado: boolean; esmaecido: boolean };
export type CargoFlowNode = Node<CargoNodeData, 'cargo'>;

export const CARD_W = 240;
export const CARD_H = 104;

function CargoCardBase({ data }: NodeProps<CargoFlowNode>) {
  const n = NIVEL[data.nivel];
  return (
    <div
      style={{ width: CARD_W, height: CARD_H }}
      className={[
        'flex cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition',
        data.selecionado ? 'ring-4 ring-blue-500' : data.destacado ? 'ring-4 ring-yellow-400' : 'ring-slate-200 hover:shadow-md',
        data.esmaecido ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* Conexões invisíveis: superior em cima, subordinados embaixo */}
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />

      <div className={`w-1.5 shrink-0 ${n.faixa}`} />
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div>
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {data.departamento}
            {data.gestor_departamento && <span title="Gestor do departamento"> · ★</span>}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">{data.titulo}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-medium ${n.badge}`}>{n.rotulo}</span>
          {data.cbo && <span className="text-slate-400">CBO {data.cbo}</span>}
          <span className="ml-auto text-slate-500" title="Entregáveis / KPIs">
            {data.qtd_entregaveis} KPI{data.qtd_entregaveis === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

export const CargoCard = memo(CargoCardBase);
