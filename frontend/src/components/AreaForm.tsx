/**
 * Modal de área (departamento): criar, renomear ou excluir.
 * Para excluir uma área com funções, a pessoa escolhe entre movê-las para outra área
 * ou excluí-las junto (a API recusa a exclusão sem essa escolha).
 */
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Departamento } from '../types';

interface Props {
  empresaId: number;
  empresaNome: string;
  area?: Departamento & { qtdCargos: number };   // ausente = criar
  outrasAreas: Departamento[];
  onSalvo: (departamentoId: number) => void;
  onExcluido: () => void;
  onClose: () => void;
}

export function AreaForm({ empresaId, empresaNome, area, outrasAreas, onSalvo, onExcluido, onClose }: Props) {
  const [nome, setNome] = useState(area?.nome ?? '');
  const [excluindo, setExcluindo] = useState(false);
  const [destino, setDestino] = useState<string>(outrasAreas[0] ? String(outrasAreas[0].id) : 'excluir');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    setOcupado(true);
    try { await acao(); } catch (e) { setErro((e as Error).message); setOcupado(false); }
  };

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    executar(async () => {
      const d = area ? await api.editarDepartamento(area.id, nome) : await api.criarDepartamento(empresaId, nome);
      onSalvo(d.id);
    });
  };

  const excluir = () => executar(async () => {
    await api.excluirDepartamento(area!.id, destino === 'excluir' ? { excluirCargos: true } : { moverPara: Number(destino) });
    onExcluido();
  });

  const campo = 'mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">{empresaNome}</p>
            <h2 className="text-lg font-bold text-slate-900">{area ? 'Editar área' : 'Nova área'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Nome da área
            <input id="area-nome" autoFocus required maxLength={150} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Ex: Informática" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button disabled={ocupado || !nome.trim()} className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {area ? 'Salvar' : 'Criar área'}
            </button>
          </div>
        </form>

        {area && (
          <div className="border-t border-slate-200 pt-3">
            {!excluindo ? (
              <button onClick={() => setExcluindo(true)} className="h-10 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50">🗑 Excluir área</button>
            ) : (
              <div role="alertdialog" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {area.qtdCargos > 0 ? (
                  <label className="block">
                    Esta área tem {area.qtdCargos} cargo(s). O que fazer com eles?
                    <select id="area-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={`${campo} text-slate-900`}>
                      {outrasAreas.map((a) => <option key={a.id} value={a.id}>Mover para {a.nome}</option>)}
                      <option value="excluir">Excluir junto (com entregáveis, funções e POPs)</option>
                    </select>
                  </label>
                ) : (
                  <p>Excluir a área "{area.nome}"?</p>
                )}
                <p className="text-xs">Isso não pode ser desfeito.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setExcluindo(false)} className="h-10 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-white">Cancelar</button>
                  <button disabled={ocupado} onClick={excluir} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                    {ocupado ? 'Excluindo…' : 'Sim, excluir'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      </div>
    </div>
  );
}
