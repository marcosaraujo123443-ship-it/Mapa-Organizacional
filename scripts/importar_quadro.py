#!/usr/bin/env python3
"""
Importa a planilha de quadro de pessoal (QUADRO.xlsx) e gera um SQL com a
estrutura de cada filial: empresa/unidade > departamentos > cargos, com a
quantidade de pessoas por cargo e a linha de reporte entre cargos.

Uso:
    pip install openpyxl
    python scripts/importar_quadro.py QUADRO.xlsx ["Grupo JC"] > database/04_filiais.sql
    psql -d mapeamento -f database/04_filiais.sql

Privacidade: o SQL gerado NÃO contém nomes, datas de nascimento, idade ou sexo.
Os nomes de líderes/gerentes são usados só em memória para descobrir a qual
cargo cada cargo reporta.

Colunas usadas da aba QUADRO: coligada, filial, descrição seção, departamento,
função4, nome cargo, nome2, lider imediato, gerente 1, gerente 2.
A aba FILIAIS dá a lista e a ordem das filiais.
"""
import collections
import sys
import unicodedata

import openpyxl

# IDs altos para não colidir com os dados de exemplo (01_schema/02_seed)
BASE_EMPRESA, BASE_DEPTO, BASE_CARGO = 1000, 1000, 10000


def sem_acento(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper()


# ---------------------------------------------------------------------------
# 1. Em qual filial cada linha entra.
# Ajuste aqui se alguma regra não refletir a realidade da empresa.
# A ordem importa: a primeira regra que casar com a seção vence.
# ---------------------------------------------------------------------------
# Trechos procurados no nome da seção
REGRAS_SECAO = [
    ('JDOCES ANAPOLIS', 'JOTA DOCES ANAPOLIS'),
    ('JDOCES GYN', 'JOTA DOCES GOIANIA'),
    ('JC ANAPOLIS', 'JC ANAPOLIS'),
    ('JC GYN', 'JC JOSE HERMANO'),
]
# Siglas/palavras inteiras na seção (ex.: "CD - PARÁ", "VENDAS - MS")
REGRAS_PALAVRA = {'PARA': 'PA', 'BA': 'BA', 'BAHIA': 'BA', 'TOCANTINS': 'TO', 'TO': 'TO',
                  'MS': 'MS', 'MA': 'MA', 'BSB': 'DF - BSB'}
# Código da filial no sistema de RH -> filial, quando a seção não diz
REGRAS_CODIGO = {(7, 3): 'DF - BSB', (7, 8): 'PA', (7, 9): 'BA', (7, 14): 'MA', (7, 16): 'MS',
                 (7, 10): 'JOTA DOCES GOIANIA', (7, 11): 'JOTA DOCES ANAPOLIS', (7, 6): 'JC ANAPOLIS',
                 (7, 4): 'JC JOSE HERMANO', (6, 2): 'BA', (11, 3): 'PA'}
FILIAL_PADRAO = 'MATRIZ'


def filial_da_linha(r) -> str:
    secao = sem_acento(r['descrição seção'] or '')
    for trecho, filial in REGRAS_SECAO:
        if trecho in secao:
            return filial
    for palavra in secao.replace('-', ' ').replace('/', ' ').split():
        if palavra in REGRAS_PALAVRA:
            return REGRAS_PALAVRA[palavra]
    return REGRAS_CODIGO.get((r['coligada'], r['filial']), FILIAL_PADRAO)


# ---------------------------------------------------------------------------
# 2. Departamento: tira o sufixo de local ("CD PARÁ" -> "CD") e unifica grafias
# ---------------------------------------------------------------------------
SUFIXOS_LOCAL = [' PARA', ' - BA', ' FILIAIS']
SINONIMOS = {'TRANSPORTES': 'TRANSPORTE', 'MANUTENCAO': 'MANUTENÇÃO', 'CDA': 'CD'}
NOMES_DEPTO = {'CD': 'CD (Centro de Distribuição)', 'RH': 'RH', 'TRANSPORTE': 'Transporte'}


def departamento_da_linha(r) -> str:
    bruto = (r['departamento'] or 'SEM DEPARTAMENTO').strip()
    chave = sem_acento(bruto)
    for suf in SUFIXOS_LOCAL:
        if chave.endswith(suf):
            chave = chave[: -len(suf)].strip()
    chave = SINONIMOS.get(chave, chave)
    if chave in NOMES_DEPTO:
        return NOMES_DEPTO[chave]
    # Mantém a grafia original (com acento) quando possível
    original = bruto.upper()
    for suf in [' PARÁ', ' - BA', ' FILIAIS']:
        if original.endswith(suf):
            original = original[: -len(suf)].strip()
    original = {'TRANSPORTES': 'TRANSPORTE', 'MANUTENCAO': 'MANUTENÇÃO'}.get(original, original)
    return titulo(original)


# ---------------------------------------------------------------------------
# 3. Nível do cargo: pela função e, se não der, pela coluna "nome cargo"
# ---------------------------------------------------------------------------
def nivel(funcao: str, nome_cargo) -> str:
    f = sem_acento(funcao)
    if f.startswith(('DIRETOR', 'CONSELHEIRO')):
        return 'diretoria'
    if f.startswith('GERENTE'):
        return 'gerencia'
    if f.startswith('COORD'):
        return 'coordenacao'
    if f.startswith(('SUPERVISOR', 'ENC.', 'ENC ', 'ENCARREGAD', 'LIDER')):
        return 'supervisao'
    if f.startswith(('ANALISTA', 'ASSISTENTE', 'ASSIST.', 'COMPRADOR', 'TECNICO', 'AUDITOR', 'FARMACEUTIC', 'CONTADOR')):
        return 'tecnico'
    n = sem_acento(nome_cargo or '')
    return {'GERENCIA': 'gerencia', 'CHEFIA': 'supervisao'}.get(n, 'operacional')


# Nome exibido de cada filial (o restante usa o próprio nome da aba FILIAIS)
NOMES_FILIAL = {'MATRIZ': 'Matriz', 'JC ANAPOLIS': 'JC Anápolis', 'JC JOSE HERMANO': 'JC José Hermano',
                'JOTA DOCES ANAPOLIS': 'Jota Doces Anápolis', 'JOTA DOCES GOIANIA': 'Jota Doces Goiânia'}

MINUSCULAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o'}
ROMANOS = {'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'}
SIGLAS = {'ti', 'rh', 'cd', 'cda', 'cftv', 'sac', 'dp', 'jc', 'pcl', 'adm.', 'adm'}


def titulo(texto: str) -> str:
    """'MOV. MERCADORIA II' -> 'Mov. Mercadoria II'; 'PROMOTOR(a) DE VENDAS' -> 'Promotor(a) de Vendas'."""
    palavras = []
    for i, p in enumerate(texto.lower().split()):
        base = p.strip('()')
        if base in ROMANOS:
            palavras.append(p.upper())
        elif base in SIGLAS and base not in ('adm.', 'adm'):
            palavras.append(p.upper())
        elif i > 0 and p in MINUSCULAS:
            palavras.append(p)
        else:
            palavras.append(p[:1].upper() + p[1:])
    return ' '.join(palavras)


def q(s):  # literal SQL
    return 'NULL' if s is None else "'" + str(s).replace("'", "''") + "'"


def main(caminho: str, grupo: str = 'Grupo JC'):
    wb = openpyxl.load_workbook(caminho, data_only=True, read_only=True)
    linhas = list(wb['QUADRO'].iter_rows(values_only=True))
    cab = linhas[0]
    quadro = [dict(zip(cab, l)) for l in linhas[1:] if any(l)]
    ordem_filiais = [l[0].strip() for l in wb['FILIAIS'].iter_rows(values_only=True) if l and l[0]]

    # Cada pessoa -> (filial, departamento, função)
    for r in quadro:
        r['_filial'] = filial_da_linha(r)
        r['_depto'] = departamento_da_linha(r)
        r['_funcao'] = ' '.join((r['função4'] or 'SEM FUNÇÃO').split())
        r['_cargo'] = (r['_filial'], r['_depto'], r['_funcao'])
    cargo_da_pessoa = {sem_acento((r['nome2'] or '').strip()): r['_cargo'] for r in quadro}

    cargos = collections.OrderedDict()
    for r in sorted(quadro, key=lambda r: r['_cargo']):
        c = cargos.setdefault(r['_cargo'], {'quadro': 0, 'nivel_votos': collections.Counter(), 'chefes': collections.Counter()})
        c['quadro'] += 1
        c['nivel_votos'][nivel(r['_funcao'], r['nome cargo'])] += 1
        # Superior: primeiro líder (imediato > gerente 1 > gerente 2) que esteja na mesma filial
        for col in ('lider imediato', 'gerente 1', 'gerente 2'):
            chefe = cargo_da_pessoa.get(sem_acento((r[col] or '').strip()))
            if chefe and chefe != r['_cargo'] and chefe[0] == r['_filial']:
                c['chefes'][chefe] += 1
                break

    # IDs
    filiais = [f for f in ordem_filiais if any(k[0] == f for k in cargos)]
    filiais += sorted({k[0] for k in cargos} - set(filiais))
    id_empresa = {f: BASE_EMPRESA + i for i, f in enumerate(filiais, 1)}
    deptos = sorted({(k[0], k[1]) for k in cargos}, key=lambda d: (filiais.index(d[0]), d[1]))
    id_depto = {d: BASE_DEPTO + i for i, d in enumerate(deptos, 1)}
    id_cargo = {k: BASE_CARGO + i for i, k in enumerate(cargos, 1)}

    NIVEL_ORDEM = ['diretoria', 'gerencia', 'coordenacao', 'supervisao', 'tecnico', 'operacional']
    niv = {k: c['nivel_votos'].most_common(1)[0][0] for k, c in cargos.items()}
    # Gestor do departamento: cargo de nível mais alto (desempate: maior quadro)
    gestor = {}
    for d in deptos:
        cands = [k for k in cargos if (k[0], k[1]) == d]
        gestor[d] = min(cands, key=lambda k: (NIVEL_ORDEM.index(niv[k]), -cargos[k]['quadro']))

    superior = {k: (c['chefes'].most_common(1)[0][0] if c['chefes'] else None) for k, c in cargos.items()}
    # Sem líder identificado na planilha: reporta ao gestor do próprio departamento,
    # desde que o gestor seja de nível mais alto (senão fica no topo)
    for k in cargos:
        g = gestor[(k[0], k[1])]
        if superior[k] is None and g != k and NIVEL_ORDEM.index(niv[g]) < NIVEL_ORDEM.index(niv[k]):
            superior[k] = g
    # Desfaz ciclos (A reporta a B que reporta a A): corta a aresta que fecha o ciclo
    for k in cargos:
        visto, atual = {k}, superior[k]
        while atual:
            if atual in visto:
                superior[k] = None
                break
            visto.add(atual)
            atual = superior[atual]

    out = ['-- Gerado por scripts/importar_quadro.py. Não contém dados pessoais.', 'BEGIN;', '']
    out.append('INSERT INTO empresas (id, nome, grupo) VALUES')
    out.append(',\n'.join(f"  ({id_empresa[f]}, {q(NOMES_FILIAL.get(f, f))}, {q(grupo)})" for f in filiais) + ';')
    out.append('\nINSERT INTO departamentos (id, empresa_id, nome) VALUES')
    out.append(',\n'.join(f"  ({id_depto[d]}, {id_empresa[d[0]]}, {q(d[1])})" for d in deptos) + ';')
    out.append('\nINSERT INTO cargos (id, departamento_id, titulo, nivel, cargo_superior_id, quadro) VALUES')
    vals = []
    for k, c in cargos.items():
        sup = id_cargo[superior[k]] if superior[k] else 'NULL'
        vals.append(f"  ({id_cargo[k]}, {id_depto[(k[0], k[1])]}, {q(titulo(k[2]))}, '{niv[k]}', {sup}, {c['quadro']})")
    out.append(',\n'.join(vals) + ';')
    out.append('')
    for d in deptos:
        out.append(f"UPDATE departamentos SET gestor_cargo_id = {id_cargo[gestor[d]]} WHERE id = {id_depto[d]};")
    out.append('')
    for t in ('empresas', 'departamentos', 'cargos'):
        out.append(f"SELECT setval(pg_get_serial_sequence('{t}','id'), (SELECT max(id) FROM {t}));")
    out.append('COMMIT;')
    print('\n'.join(out))

    # Resumo no stderr
    print(f'{len(quadro)} pessoas, {len(filiais)} filiais, {len(deptos)} departamentos, {len(cargos)} cargos', file=sys.stderr)
    for f in filiais:
        ks = [k for k in cargos if k[0] == f]
        topo = sum(1 for k in ks if not superior[k])
        print(f'  {f:22} pessoas={sum(cargos[k]["quadro"] for k in ks):4}  deptos={len({k[1] for k in ks}):2}  cargos={len(ks):3}  sem superior={topo}', file=sys.stderr)


if __name__ == '__main__':
    main(*sys.argv[1:3])
