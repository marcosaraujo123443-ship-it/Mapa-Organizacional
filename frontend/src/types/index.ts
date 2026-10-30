/** Tipos espelhando as respostas da API (/api/v1). */

export type Nivel = 'operacional' | 'tecnico' | 'supervisao' | 'coordenacao' | 'gerencia' | 'diretoria';

export interface CargoRef { id: number; titulo: string }

export type OrgNode = {
  id: number;
  titulo: string;
  cbo: string | null;
  nivel: Nivel;
  cargo_superior_id: number | null;
  quadro: number | null;           // pessoas no cargo
  departamento_id: number;
  departamento: string;
  gestor_departamento: boolean;
  qtd_entregaveis: number;
};

export interface Organograma {
  nodes: OrgNode[];
  edges: { id: string; source: string; target: string }[];
}

export interface PopResumo {
  id: number;
  codigo_pop: string;
  versao: string;
  titulo: string;
  data_atualizacao: string;
}

export interface Atividade {
  id: number;
  nome: string;
  tempo_estimado: string | null;
  raci: {
    responsavel: CargoRef | null;
    aprovador: CargoRef | null;
    consultados: CargoRef[];
    informados: CargoRef[];
  };
  pops: PopResumo[];
}

export interface Entregavel {
  id: number;
  titulo: string;
  kpi_meta: string | null;
  frequencia: string;
  atividades: Atividade[];
}

export interface HierarquiaCargo {
  id: number;
  titulo: string;
  cbo: string | null;
  nivel: Nivel;
  quadro: number | null;
  empresa: { id: number; nome: string; cnpj: string | null };
  departamento: { id: number; nome: string };
  cadeia_superiores: CargoRef[];
  subordinados: (CargoRef & { nivel: Nivel; cargo_superior_id: number; profundidade: number })[];
  entregaveis: Entregavel[];
  participacoes_raci: { papel: 'R' | 'A' | 'C' | 'I'; atividade: Atividade; dono: CargoRef }[];
}

export interface ChecklistItem { ordem: number; item: string; obrigatorio: boolean }
export interface Anexo { tipo: 'imagem' | 'video' | 'pdf' | string; url: string; descricao: string }

export interface Pop extends PopResumo {
  atividade_id: number;
  atividade_nome: string;
  conteudo_markdown: string;
  checklist_json: ChecklistItem[];
  anexos_json: Anexo[];
}

export interface ResultadoBusca {
  tipo: 'cargo' | 'entregavel' | 'atividade' | 'pop';
  id: number;
  titulo: string;
  contexto: string;
  trecho: string | null;
  cargo_id: number;
  atividade_id: number | null;
  score: number;
}

export interface Departamento { id: number; nome: string }

/** Empresa ou filial, com totais para o seletor. */
export interface Empresa { id: number; nome: string; qtd_cargos: number; quadro: number }

/** Corpos aceitos pelas rotas de escrita. */
export interface NovoCargo {
  departamento_id: number;
  titulo: string;
  cbo?: string | null;
  nivel: Nivel;
  cargo_superior_id?: number | null;
  quadro?: number | null;
}

export interface NovoEntregavel {
  cargo_id: number;
  titulo: string;
  kpi_meta?: string | null;
  frequencia: string;
}

export interface NovaAtividade {
  entregavel_id: number;
  nome: string;
  tempo_estimado?: string | null;
  raci_responsavel_id?: number | null;
  raci_aprovador_id?: number | null;
}
