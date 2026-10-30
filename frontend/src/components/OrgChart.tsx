/**
 * Organograma em árvore que abre por cliques (React Flow + layout dagre da esquerda p/ direita):
 *
 *   Grupo  ›  Empresas  ›  Áreas  ›  Funções (cargos, com a hierarquia interna da área)
 *
 * Só os níveis abertos são desenhados, então até um grupo grande continua legível.
 * Clicar em um cargo abre a gaveta com Entregáveis › Atividades (RACI) › POP.
 */
import { useEffect, useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import { Background, Controls, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Empresa, Organograma } from '../types';
import { CARD_H, CARD_W, CargoCard } from './CargoCard';
import { AREA_H, AREA_W, AreaNode, EMPRESA_H, EMPRESA_W, EmpresaNode, GRUPO_H, GRUPO_W, GrupoNode } from './TreeNodes';

const nodeTypes = { grupo: GrupoNode, empresa: EmpresaNode, area: AreaNode, cargo: CargoCard };
const TAMANHO: Record<string, [number, number]> = {
  grupo: [GRUPO_W, GRUPO_H], empresa: [EMPRESA_W, EMPRESA_H], area: [AREA_W, AREA_H], cargo: [CARD_W, CARD_H],
};

export interface Abertos { grupos: Set<string>; empresas: Set<number>; areas: Set<number> }

interface Props {
  empresas: Empresa[];
  organogramas: Map<number, Organograma>;     // empresas já carregadas
  carregando: Set<number>;
  abertos: Abertos;
  selecionadoId: number | null;
  destaqueIds: Set<number>;                     // cargos encontrados pela busca
  foco: string | null;                          // id do nó a centralizar (ex.: "c:12")
  onToggleGrupo: (nome: string) => void;
  onToggleEmpresa: (id: number) => void;
  onToggleArea: (id: number) => void;
  onSelectCargo: (id: number) => void;
  onNovoCargo: (empresaId: number, departamentoId: number) => void;
  onNovaArea: (empresaId: number) => void;
  onEditarArea: (empresaId: number, departamentoId: number) => void;
}

const edge = (source: string, target: string): Edge => ({
  id: `${source}>${target}`, source, target, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 },
});

export function OrgChart(p: Props) {
  const { setCenter, getZoom } = useReactFlow();
  const buscando = p.destaqueIds.size > 0;

  // 1. Monta só os nós visíveis
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const grupos = new Map<string, Empresa[]>();
    p.empresas.forEach((e) => grupos.set(e.grupo, [...(grupos.get(e.grupo) ?? []), e]));
    // Grupo com mais pessoas primeiro
    const total = (es: Empresa[]) => es.reduce((n, e) => n + e.quadro, 0);
    const ordenados = [...grupos].sort((a, b) => total(b[1]) - total(a[1]));

    for (const [nome, emps] of ordenados) {
      const gid = `g:${nome}`;
      const grupoAberto = p.abertos.grupos.has(nome);
      nodes.push({ id: gid, type: 'grupo', position: { x: 0, y: 0 }, data: { nome, empresas: emps.length, quadro: emps.reduce((n, e) => n + e.quadro, 0), aberto: grupoAberto } });
      if (!grupoAberto) continue;

      for (const emp of emps) {
        const eid = `e:${emp.id}`;
        const org = p.organogramas.get(emp.id);
        const empAberta = p.abertos.empresas.has(emp.id) && !!org;
        nodes.push({ id: eid, type: 'empresa', position: { x: 0, y: 0 }, data: { nome: emp.nome, quadro: emp.quadro, cargos: emp.qtd_cargos, aberto: empAberta, carregando: p.carregando.has(emp.id), onNovaArea: () => p.onNovaArea(emp.id) } });
        edges.push(edge(gid, eid));
        if (!empAberta) continue;

        // Áreas = todos os departamentos da empresa (inclusive vazios), em ordem alfabética
        const areas = new Map<number, { nome: string; cargos: Organograma['nodes'] }>();
        org.departamentos?.forEach((d) => areas.set(d.id, { nome: d.nome, cargos: [] }));
        org.nodes.forEach((c) => {
          const a = areas.get(c.departamento_id) ?? { nome: c.departamento, cargos: [] };
          a.cargos.push(c);
          areas.set(c.departamento_id, a);
        });
        for (const [did, area] of [...areas].sort((a, b) => a[1].nome.localeCompare(b[1].nome))) {
          const aid = `a:${did}`;
          const areaAberta = p.abertos.areas.has(did);
          nodes.push({
            id: aid, type: 'area', position: { x: 0, y: 0 },
            data: {
              nome: area.nome, cargos: area.cargos.length, quadro: area.cargos.reduce((n, c) => n + (c.quadro ?? 0), 0),
              aberto: areaAberta, onNovoCargo: () => p.onNovoCargo(emp.id, did), onEditar: () => p.onEditarArea(emp.id, did),
            },
          });
          edges.push(edge(eid, aid));
          if (!areaAberta) continue;

          // Cargos: ligados ao superior quando ele é da mesma área; senão, à própria área
          const naArea = new Set(area.cargos.map((c) => c.id));
          for (const c of area.cargos) {
            nodes.push({
              id: `c:${c.id}`, type: 'cargo', position: { x: 0, y: 0 },
              data: {
                ...c,
                selecionado: c.id === p.selecionadoId,
                destacado: p.destaqueIds.has(c.id),
                esmaecido: buscando && !p.destaqueIds.has(c.id) && c.id !== p.selecionadoId,
              },
            });
            edges.push(edge(c.cargo_superior_id && naArea.has(c.cargo_superior_id) ? `c:${c.cargo_superior_id}` : aid, `c:${c.id}`));
          }
        }
      }
    }

    // 2. Layout em árvore da esquerda para a direita
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 56 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach((n) => { const [w, h] = TAMANHO[n.type!]; g.setNode(n.id, { width: w, height: h }); });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    nodes.forEach((n) => {
      const [w, h] = TAMANHO[n.type!];
      const pos = g.node(n.id);
      n.position = { x: pos.x - w / 2, y: pos.y - h / 2 };
      n.draggable = false;
    });
    return { nodes, edges };
  }, [p.empresas, p.organogramas, p.carregando, p.abertos, p.selecionadoId, p.destaqueIds, buscando, p.onNovoCargo, p.onNovaArea, p.onEditarArea]);

  // Centraliza o nó em foco (o que acabou de ser aberto ou selecionado)
  useEffect(() => {
    const n = p.foco ? nodes.find((x) => x.id === p.foco) : null;
    if (!n) return;
    const [w, h] = TAMANHO[n.type!];
    // Nós que abrem filhos à direita ficam um pouco à esquerda do centro (só em telas largas)
    const desvio = n.type !== 'cargo' && window.innerWidth >= 768 ? 160 : 0;
    setCenter(n.position.x + w / 2 + desvio, n.position.y + h / 2, { zoom: Math.max(getZoom(), 0.75), duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.foco, nodes.length]);

  const onNodeClick = (_: unknown, n: Node) => {
    const [tipo, id] = [n.id.slice(0, 1), n.id.slice(2)];
    if (tipo === 'g') p.onToggleGrupo(id);
    else if (tipo === 'e') p.onToggleEmpresa(Number(id));
    else if (tipo === 'a') p.onToggleArea(Number(id));
    else p.onSelectCargo(Number(id));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} color="#cbd5e1" />
      <Controls showInteractive={false} className="!bottom-4 !left-4" />
    </ReactFlow>
  );
}
