/** Cores e rótulos por nível hierárquico, usados no card e no drawer. */
import type { Nivel } from '../types';

export const NIVEL: Record<Nivel, { rotulo: string; faixa: string; badge: string }> = {
  diretoria:   { rotulo: 'Diretoria',   faixa: 'bg-indigo-700',  badge: 'bg-indigo-100 text-indigo-800' },
  gerencia:    { rotulo: 'Gerência',    faixa: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-800' },
  coordenacao: { rotulo: 'Coordenação', faixa: 'bg-cyan-600',    badge: 'bg-cyan-100 text-cyan-800' },
  supervisao:  { rotulo: 'Supervisão',  faixa: 'bg-teal-600',    badge: 'bg-teal-100 text-teal-800' },
  tecnico:     { rotulo: 'Técnico',     faixa: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800' },
  operacional: { rotulo: 'Operacional', faixa: 'bg-slate-500',   badge: 'bg-slate-200 text-slate-700' },
};
