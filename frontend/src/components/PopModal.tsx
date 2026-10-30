/**
 * Modal do POP (Procedimento Operacional Padrão).
 * - Renderiza o passo a passo em Markdown (tabelas via GFM).
 * - Checklist interativo; o progresso fica salvo no dispositivo (por código + versão do POP),
 *   útil para o colaborador no chão de armazém, inclusive offline.
 * - Lista anexos/mídias (imagem, vídeo, PDF).
 */
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api/client';
import type { Pop } from '../types';

const ICONE: Record<string, string> = { imagem: '🖼️', video: '🎬', pdf: '📄' };

const chave = (p: Pop) => `pop-check:${p.codigo_pop}:${p.versao}`;
const lerChecks = (k: string): number[] => {
  try { return JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { return []; }
};
const salvarChecks = (k: string, v: number[]) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage indisponível */ }
};

export function PopModal({ popId, onClose }: { popId: number; onClose: () => void }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<number[]>([]);

  useEffect(() => {
    api.pop(popId)
      .then((p) => { setPop(p); setFeitos(lerChecks(chave(p))); })
      .catch((e) => setErro(String(e.message ?? e)));
  }, [popId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const alternar = (ordem: number) => {
    if (!pop) return;
    const novo = feitos.includes(ordem) ? feitos.filter((o) => o !== ordem) : [...feitos, ordem];
    setFeitos(novo);
    salvarChecks(chave(pop), novo);
  };

  const total = pop?.checklist_json.length ?? 0;
  const obrigPendentes = pop?.checklist_json.filter((c) => c.obrigatorio && !feitos.includes(c.ordem)).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:h-[85vh] md:max-w-3xl md:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0 flex-1">
            {pop && (
              <p className="text-xs font-medium text-blue-700">
                {pop.codigo_pop} · v{pop.versao} · atualizado em {new Date(pop.data_atualizacao).toLocaleDateString('pt-BR')}
              </p>
            )}
            <h2 className="text-lg font-bold leading-tight text-slate-900">{pop?.titulo ?? 'Carregando POP…'}</h2>
            {pop && <p className="text-xs text-slate-500">Atividade: {pop.atividade_nome}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          {pop && (
            <div className="grid gap-6 md:grid-cols-[1fr_260px]">
              <article className="prose prose-sm prose-slate max-w-none prose-table:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{pop.conteudo_markdown}</ReactMarkdown>
              </article>

              <aside className="space-y-4">
                {total > 0 && (
                  <section className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase text-slate-500">Checklist</h3>
                      <span className="text-xs text-slate-600">{feitos.length}/{total}</span>
                    </div>
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(feitos.length / total) * 100}%` }} />
                    </div>
                    <ul className="space-y-1">
                      {pop.checklist_json.map((c) => (
                        <li key={c.ordem}>
                          {/* Área de toque grande para uso com luva / no celular */}
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-white">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
                              checked={feitos.includes(c.ordem)}
                              onChange={() => alternar(c.ordem)}
                            />
                            <span className={`text-sm ${feitos.includes(c.ordem) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {c.item}
                              {c.obrigatorio && <span className="ml-1 text-red-500" title="Obrigatório">*</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className={`mt-2 text-xs ${obrigPendentes ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {obrigPendentes ? `${obrigPendentes} item(ns) obrigatório(s) pendente(s)` : '✓ Itens obrigatórios concluídos'}
                    </p>
                  </section>
                )}

                {pop.anexos_json.length > 0 && (
                  <section className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Anexos e mídias</h3>
                    <ul className="space-y-1">
                      {pop.anexos_json.map((a) => (
                        <li key={a.url}>
                          <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg p-2 text-sm text-blue-700 hover:bg-white">
                            <span>{ICONE[a.tipo] ?? '📎'}</span> {a.descricao}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
