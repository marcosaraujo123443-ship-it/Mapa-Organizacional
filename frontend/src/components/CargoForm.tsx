/**
 * Modal para criar um cargo novo ou editar um existente
 * (nome, departamento, nível, CBO e a quem o cargo reporta).
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Departamento, Nivel, OrgNode } from '../types';
import { NIVEL } from './nivel';

interface Props {
  cargo?: OrgNode;              // ausente = criar
  cargos: OrgNode[];
  departamentos: Departamento[];
  onSalvo: (cargoId: number) => void;
  onClose: () => void;
}

export function CargoForm({ cargo, cargos, departamentos, onSalvo, onClose }: Props) {
  const [titulo, setTitulo] = useState(cargo?.titulo ?? '');
  const [departamentoId, setDepartamentoId] = useState(cargo?.departamento_id ?? departamentos[0]?.id ?? 0);
  const [nivel, setNivel] = useState<Nivel>(cargo?.nivel ?? 'operacional');
  const [cbo, setCbo] = useState(cargo?.cbo ?? '');
  const [superiorId, setSuperiorId] = useState<number | ''>(cargo?.cargo_superior_id ?? '');
  const [quadro, setQuadro] = useState(cargo?.quadro != null ? String(cargo.quadro) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Na edição, o cargo e seus subordinados não podem virar superiores dele mesmo
  const bloqueados = useMemo(() => {
    const ids = new Set<number>();
    if (!cargo) return ids;
    const fila = [cargo.id];
    while (fila.length) {
      const id = fila.pop()!;
      ids.add(id);
      cargos.filter((c) => c.cargo_superior_id === id).forEach((c) => fila.push(c.id));
    }
    return ids;
  }, [cargo, cargos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const dados = {
      titulo,
      departamento_id: departamentoId,
      nivel,
      cbo: cbo || null,
      cargo_superior_id: superiorId === '' ? null : superiorId,
      quadro: quadro === '' ? null : Number(quadro),
    };
    try {
      const salvo = cargo ? await api.editarCargo(cargo.id, dados) : await api.criarCargo(dados);
      onSalvo(salvo.id);
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  };

  const campo = 'mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6" onClick={onClose}>
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="w-full space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">{cargo ? 'Editar cargo' : 'Novo cargo'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Nome do cargo
          <input id="cargo-titulo" autoFocus required maxLength={150} value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} placeholder="Ex: Líder de Expedição" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Departamento
            <select id="cargo-departamento" value={departamentoId} onChange={(e) => setDepartamentoId(Number(e.target.value))} className={campo}>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nível
            <select id="cargo-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)} className={campo}>
              {Object.entries(NIVEL).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[1fr_6rem_6rem] gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Reporta para
            <select id="cargo-superior" value={superiorId} onChange={(e) => setSuperiorId(e.target.value ? Number(e.target.value) : '')} className={campo}>
              <option value="">Ninguém (topo)</option>
              {cargos.filter((c) => !bloqueados.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            CBO
            <input id="cargo-cbo" maxLength={10} value={cbo} onChange={(e) => setCbo(e.target.value)} className={campo} placeholder="0000-00" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Pessoas
            <input id="cargo-quadro" type="number" min={0} step={1} inputMode="numeric" value={quadro} onChange={(e) => setQuadro(e.target.value)} className={campo} placeholder="0" />
          </label>
        </div>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-11 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button disabled={salvando || !titulo.trim()} className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando…' : cargo ? 'Salvar' : 'Criar cargo'}
          </button>
        </div>
      </form>
    </div>
  );
}
