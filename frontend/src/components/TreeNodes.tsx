/**
 * Nós estruturais da árvore: Grupo › Empresa › Área.
 * Clicar no nó abre ou fecha o próximo nível (o React Flow repassa o clique ao App).
 */
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export const GRUPO_W = 260, GRUPO_H = 88;
export const EMPRESA_W = 240, EMPRESA_H = 76;
export const AREA_W = 270, AREA_H = 68;

const fmt = (n: number) => n.toLocaleString('pt-BR');
const plural = (n: number, um: string, varios: string) => `${fmt(n)} ${n === 1 ? um : varios}`;

const Entrada = () => <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />;
const Saida = () => <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />;

/** Seta que mostra se o nó está aberto. */
const Seta = ({ aberto, claro }: { aberto: boolean; claro?: boolean }) => (
  <span
    aria-hidden
    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-transform ${aberto ? 'rotate-90' : ''} ${claro ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}
  >
    ›
  </span>
);

export type GrupoData = { nome: string; empresas: number; quadro: number; aberto: boolean };
export type EmpresaData = { nome: string; quadro: number; cargos: number; aberto: boolean; carregando: boolean };
export type AreaData = { nome: string; quadro: number; cargos: number; aberto: boolean; onNovoCargo: () => void };

export const GrupoNode = memo(({ data }: NodeProps<Node<GrupoData, 'grupo'>>) => (
  <div style={{ width: GRUPO_W, height: GRUPO_H }} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-indigo-900 px-4 text-white shadow-lg ring-1 ring-indigo-950 hover:bg-indigo-800">
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-200">Grupo</p>
      <p className="truncate text-lg font-bold leading-tight">{data.nome}</p>
      <p className="text-xs text-indigo-200">{plural(data.empresas, 'empresa', 'empresas')} · {plural(data.quadro, 'pessoa', 'pessoas')}</p>
    </div>
    <Seta aberto={data.aberto} claro />
    <Saida />
  </div>
));

export const EmpresaNode = memo(({ data }: NodeProps<Node<EmpresaData, 'empresa'>>) => (
  <div style={{ width: EMPRESA_W, height: EMPRESA_H }} className={`flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 shadow-sm ring-1 hover:shadow-md ${data.aberto ? 'ring-2 ring-indigo-400' : 'ring-slate-200'}`}>
    <Entrada />
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg">🏢</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-900">{data.nome}</p>
      <p className="text-[11px] text-slate-500">{plural(data.quadro, 'pessoa', 'pessoas')} · {plural(data.cargos, 'função', 'funções')}</p>
    </div>
    {data.carregando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" /> : <Seta aberto={data.aberto} />}
    <Saida />
  </div>
));

export const AreaNode = memo(({ data }: NodeProps<Node<AreaData, 'area'>>) => (
  <div style={{ width: AREA_W, height: AREA_H }} className={`flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 hover:bg-white ${data.aberto ? 'ring-2 ring-teal-400' : 'ring-slate-200'}`}>
    <Entrada />
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-teal-700">Área</p>
      <p className="truncate text-sm font-semibold text-slate-900">{data.nome}</p>
      <p className="text-[11px] text-slate-500">{plural(data.quadro, 'pessoa', 'pessoas')} · {plural(data.cargos, 'função', 'funções')}</p>
    </div>
    {/* stopPropagation: o "+" cria cargo nesta área sem abrir/fechar o nó */}
    <button
      onClick={(e) => { e.stopPropagation(); data.onNovoCargo(); }}
      title="Adicionar cargo nesta área"
      aria-label="Adicionar cargo nesta área"
      className="nodrag flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
    >
      +
    </button>
    <Seta aberto={data.aberto} />
    <Saida />
  </div>
));
