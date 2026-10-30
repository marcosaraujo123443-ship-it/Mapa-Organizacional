/**
 * Organograma interativo (React Flow + layout automático em árvore via dagre).
 * - Clique/toque em um card abre o drawer do cargo.
 * - Resultados da busca ficam destacados; os demais cargos são esmaecidos.
 * - Pan/zoom por gesto (pinça) no mobile.
 */
import { useEffect, useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import { Background, Controls, MiniMap, ReactFlow, useReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Organograma } from '../types';
import { CARD_H, CARD_W, CargoCard, type CargoFlowNode } from './CargoCard';

const nodeTypes = { cargo: CargoCard };

/** Calcula posições x/y de cada cargo em árvore de cima para baixo. */
function layout(org: Organograma) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  org.nodes.forEach((n) => g.setNode(String(n.id), { width: CARD_W, height: CARD_H }));
  org.edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return new Map(org.nodes.map((n) => {
    const p = g.node(String(n.id));
    return [n.id, { x: p.x - CARD_W / 2, y: p.y - CARD_H / 2 }];
  }));
}

interface Props {
  org: Organograma;
  selecionadoId: number | null;
  destaqueIds: Set<number>;       // cargos encontrados pela busca
  onSelect: (cargoId: number) => void;
}

export function OrgChart({ org, selecionadoId, destaqueIds, onSelect }: Props) {
  const { setCenter, getZoom } = useReactFlow();
  const posicoes = useMemo(() => layout(org), [org]);
  const buscando = destaqueIds.size > 0;

  const nodes: CargoFlowNode[] = useMemo(
    () =>
      org.nodes.map((n) => ({
        id: String(n.id),
        type: 'cargo',
        position: posicoes.get(n.id)!,
        draggable: false,
        data: {
          ...n,
          selecionado: n.id === selecionadoId,
          destacado: destaqueIds.has(n.id),
          esmaecido: buscando && !destaqueIds.has(n.id) && n.id !== selecionadoId,
        },
      })),
    [org, posicoes, selecionadoId, destaqueIds, buscando],
  );

  const edges: Edge[] = useMemo(
    () => org.edges.map((e) => ({ ...e, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 } })),
    [org],
  );

  // Centraliza o cargo selecionado (ex: vindo da busca) mantendo o contexto visual
  useEffect(() => {
    const p = selecionadoId ? posicoes.get(selecionadoId) : null;
    if (p) setCenter(p.x + CARD_W / 2, p.y + CARD_H / 2, { zoom: Math.max(getZoom(), 0.9), duration: 500 });
  }, [selecionadoId, posicoes, setCenter, getZoom]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(Number(node.id))}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} color="#cbd5e1" />
      <Controls showInteractive={false} className="!bottom-4 !left-4" />
      <MiniMap pannable zoomable className="!hidden md:!block" nodeColor={(n) => (n.data as any).destacado ? '#facc15' : '#64748b'} />
    </ReactFlow>
  );
}
