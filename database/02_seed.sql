-- =============================================================================
-- DADOS FICTÍCIOS (DUMMY DATA) - FLUXO DE LOGÍSTICA / RECEBIMENTO
-- Todos os nomes, CNPJ e CBOs são ilustrativos.
-- IDs explícitos para facilitar testes (ex: GET /api/v1/cargos/4/hierarquia).
-- =============================================================================

BEGIN;

-- 1. EMPRESA ------------------------------------------------------------------
INSERT INTO empresas (id, nome, cnpj) VALUES
  (1, 'Grupo Exemplo S/A - Matriz', '11222333000181');

-- 2. DEPARTAMENTOS (gestor definido após criar os cargos) ---------------------
INSERT INTO departamentos (id, empresa_id, nome) VALUES
  (1, 1, 'Diretoria de Operações'),
  (2, 1, 'Logística'),
  (3, 1, 'Prevenção de Perdas'),
  (4, 1, 'TI');

-- 3. CARGOS (organograma via cargo_superior_id) -------------------------------
INSERT INTO cargos (id, departamento_id, titulo, cbo, nivel, cargo_superior_id) VALUES
  ( 1, 1, 'Diretor de Operações',            '1421-05', 'diretoria',   NULL),
  ( 2, 2, 'Gerente de Logística',            '1416-10', 'gerencia',    1),
  ( 3, 2, 'Supervisor de Recebimento',       '4101-05', 'supervisao',  2),
  ( 4, 2, 'Conferente de Estoque',           '4141-05', 'operacional', 3),
  ( 5, 2, 'Operador de Empilhadeira',        '7822-20', 'operacional', 3),
  ( 6, 2, 'Auxiliar de Recebimento',         '4141-10', 'operacional', 3),
  ( 7, 2, 'Analista de Inventário',          '4141-15', 'tecnico',     2),
  ( 8, 3, 'Gerente de Prevenção de Perdas',  '1423-05', 'gerencia',    1),
  ( 9, 3, 'Fiscal de Prevenção de Perdas',   '5173-30', 'operacional', 8),
  (10, 4, 'Coordenador de TI',               '1425-05', 'coordenacao', 1),
  (11, 4, 'Analista de Sistemas WMS',        '2124-05', 'tecnico',     10);

UPDATE departamentos SET gestor_cargo_id = 1  WHERE id = 1;
UPDATE departamentos SET gestor_cargo_id = 2  WHERE id = 2;
UPDATE departamentos SET gestor_cargo_id = 8  WHERE id = 3;
UPDATE departamentos SET gestor_cargo_id = 10 WHERE id = 4;

-- 4. ENTREGÁVEIS / KPIs -------------------------------------------------------
INSERT INTO entregaveis (id, cargo_id, titulo, kpi_meta, frequencia) VALUES
  (1, 3,  'Recebimento dentro da janela de doca',   '>= 95% das cargas descarregadas em até 2h após chegada', 'diaria'),
  (2, 3,  'Relatório de divergências de recebimento','Entregue até segunda 10h; 100% das divergências tratadas', 'semanal'),
  (3, 4,  'Conferência física de NF-e',             'Acuracidade de conferência >= 99,5%',                    'diaria'),
  (4, 4,  'Mercadoria endereçada e disponível',     '100% dos paletes endereçados em até 4h após conferência', 'diaria'),
  (5, 5,  'Movimentação segura de paletes',         'Zero acidentes; 100% checklists pré-operacionais',       'diaria'),
  (6, 7,  'Inventário cíclico',                     'Acuracidade de estoque >= 98% (curva A >= 99,5%)',       'semanal'),
  (7, 9,  'Auditoria de recebimento',               'Auditar 10% das cargas recebidas; perdas < 0,3% do CMV', 'diaria'),
  (8, 2,  'OTIF de abastecimento',                  'OTIF >= 96%',                                            'mensal'),
  (9, 11, 'Disponibilidade do WMS',                 'Uptime >= 99,9%; integração NF-e sem fila > 15 min',     'mensal');

-- 5. ATIVIDADES (RACI: R e A = cargo único; C e I = arrays de cargos) ---------
INSERT INTO atividades (id, entregavel_id, nome, tempo_estimado,
                        raci_responsavel_id, raci_aprovador_id, raci_consultado, raci_informado) VALUES
  ( 1, 1, 'Agendamento e liberação de doca',                '00:15', 3,  2,  '{11}',  '{9}'),
  ( 2, 1, 'Recepção do motorista e checagem documental',    '00:10', 6,  3,  '{}',    '{9}'),
  ( 3, 3, 'Conferência cega de volumes e SKUs',             '00:45', 4,  3,  '{7}',   '{9,2}'),
  ( 4, 3, 'Tratativa de divergência (falta/sobra/avaria)',  '00:30', 4,  3,  '{9,7}', '{2}'),
  ( 5, 4, 'Endereçamento no WMS e armazenagem',             '00:20', 5,  3,  '{11}',  '{7}'),
  ( 6, 2, 'Consolidação semanal de divergências',           '02:00', 3,  2,  '{9}',   '{8}'),
  ( 7, 6, 'Contagem cíclica por curva ABC',                 '03:00', 7,  2,  '{4}',   '{8}'),
  ( 8, 7, 'Auditoria amostral de cargas recebidas',         '00:40', 9,  8,  '{3}',   '{2}'),
  ( 9, 5, 'Checklist pré-operacional da empilhadeira',      '00:10', 5,  3,  '{}',    '{}'),
  (10, 9, 'Monitoramento das integrações WMS/ERP',          '01:00', 11, 10, '{}',    '{3}'),
  (11, 8, 'Análise mensal do OTIF',                         '04:00', 2,  1,  '{3,7}', '{8}');

-- 6. POPs ---------------------------------------------------------------------
INSERT INTO pops_passo_a_passo (id, atividade_id, codigo_pop, versao, titulo, conteudo_markdown, checklist_json, anexos_json) VALUES
(1, 1, 'POP-LOG-REC-001', '1.2', 'Agendamento e liberação de doca',
$md$## Objetivo
Garantir que toda carga seja recebida em doca previamente agendada, evitando filas no pátio.

## Passo a passo
1. Consultar a **agenda de docas** no WMS (tela *Recebimento > Agenda*).
2. Validar se o fornecedor possui agendamento para a data/hora.
3. Sem agendamento: acionar o Supervisor para encaixe ou reagendamento.
4. Liberar a doca no sistema e informar o número da doca à portaria.
5. Registrar o horário de **encosto do veículo**.

> ⚠️ Cargas refrigeradas têm prioridade de doca.$md$,
'[{"ordem":1,"item":"Agenda conferida no WMS","obrigatorio":true},
  {"ordem":2,"item":"Doca liberada no sistema","obrigatorio":true},
  {"ordem":3,"item":"Portaria informada","obrigatorio":true},
  {"ordem":4,"item":"Horário de encosto registrado","obrigatorio":true}]',
'[{"tipo":"imagem","url":"/anexos/agenda-docas.png","descricao":"Tela de agenda de docas"}]'),

(2, 2, 'POP-LOG-REC-002', '1.0', 'Recepção do motorista e checagem documental',
$md$## Objetivo
Validar a documentação fiscal antes da descarga.

## Passo a passo
1. Solicitar **DANFE** e documento do motorista.
2. Bipar a chave de acesso da NF-e no coletor.
3. Verificar se o pedido de compra está **aberto** e se o CNPJ do emitente confere.
4. Conferir o **lacre** do baú com o número informado na NF-e.
5. Divergência documental: **não iniciar a descarga** e acionar o Supervisor.$md$,
'[{"ordem":1,"item":"DANFE recebido","obrigatorio":true},
  {"ordem":2,"item":"Chave NF-e bipada","obrigatorio":true},
  {"ordem":3,"item":"Pedido de compra validado","obrigatorio":true},
  {"ordem":4,"item":"Lacre conferido e fotografado","obrigatorio":true}]',
'[]'),

(3, 3, 'POP-LOG-REC-003', '2.1', 'Conferência cega de volumes e SKUs',
$md$## Objetivo
Conferir fisicamente a mercadoria **sem visualizar as quantidades da NF-e** (conferência cega), garantindo acuracidade ≥ 99,5%.

## EPIs obrigatórios
- Botina de segurança, colete refletivo e luvas.

## Passo a passo
1. Iniciar a tarefa de conferência no coletor (*Recebimento > Conferir*).
2. Para cada palete: bipar o **EAN/DUN** e informar a quantidade contada.
3. Verificar **validade e lote** (produtos com shelf-life < 70% devem ser sinalizados).
4. Inspecionar avarias visíveis (caixas amassadas, molhadas, violadas).
5. Finalizar a conferência. O WMS comparará com a NF-e.
6. Havendo divergência, seguir o **POP-LOG-REC-004**.

## Critérios de aceite
| Situação | Ação |
|---|---|
| Quantidade OK | Liberar para endereçamento |
| Falta/Sobra | Abrir divergência |
| Avaria | Segregar e fotografar |$md$,
'[{"ordem":1,"item":"EPIs em uso","obrigatorio":true},
  {"ordem":2,"item":"Todos os SKUs bipados","obrigatorio":true},
  {"ordem":3,"item":"Validade e lote verificados","obrigatorio":true},
  {"ordem":4,"item":"Avarias fotografadas","obrigatorio":false},
  {"ordem":5,"item":"Conferência finalizada no coletor","obrigatorio":true}]',
'[{"tipo":"video","url":"/anexos/treinamento-conferencia-cega.mp4","descricao":"Treinamento de conferência cega (3 min)"},
  {"tipo":"pdf","url":"/anexos/tabela-shelf-life.pdf","descricao":"Tabela de shelf-life mínimo por categoria"}]'),

(4, 4, 'POP-LOG-REC-004', '1.3', 'Tratativa de divergência de recebimento',
$md$## Objetivo
Registrar e tratar faltas, sobras e avarias identificadas na conferência.

## Passo a passo
1. Classificar a divergência: **falta**, **sobra** ou **avaria**.
2. Fotografar a evidência (palete, etiqueta, embalagem).
3. Registrar no WMS (*Recebimento > Divergências*) anexando as fotos.
4. Solicitar assinatura do motorista na **ressalva do CT-e/canhoto**.
5. Segregar itens avariados na **área de quarentena** (rua Q).
6. Informar o Fiscal de Prevenção de Perdas quando valor > R$ 500.$md$,
'[{"ordem":1,"item":"Divergência classificada","obrigatorio":true},
  {"ordem":2,"item":"Fotos anexadas","obrigatorio":true},
  {"ordem":3,"item":"Ressalva assinada pelo motorista","obrigatorio":true},
  {"ordem":4,"item":"Item segregado em quarentena","obrigatorio":false}]',
'[]'),

(5, 5, 'POP-LOG-ARM-001', '1.0', 'Endereçamento no WMS e armazenagem',
$md$## Objetivo
Armazenar o palete no endereço sugerido pelo WMS em até 4h.

## Passo a passo
1. Bipar a etiqueta do palete no coletor da empilhadeira.
2. Seguir até o endereço sugerido (Rua-Prédio-Nível-Apto).
3. Bipar a **etiqueta do endereço** antes de depositar.
4. Endereço ocupado/bloqueado: solicitar novo endereço pelo coletor.
5. Confirmar a armazenagem.$md$,
'[{"ordem":1,"item":"Etiqueta do palete bipada","obrigatorio":true},
  {"ordem":2,"item":"Etiqueta do endereço bipada","obrigatorio":true},
  {"ordem":3,"item":"Armazenagem confirmada","obrigatorio":true}]',
'[]'),

(6, 8, 'POP-PP-AUD-001', '1.1', 'Auditoria amostral de cargas recebidas',
$md$## Objetivo
Auditar por amostragem 10% das cargas para mitigar perdas no recebimento.

## Passo a passo
1. Sortear as cargas do dia pelo relatório *PP > Amostragem*.
2. Recontar os itens de maior valor agregado (curva A).
3. Comparar com a conferência registrada.
4. Registrar o resultado e, se houver diferença, abrir ocorrência.$md$,
'[{"ordem":1,"item":"Cargas sorteadas","obrigatorio":true},
  {"ordem":2,"item":"Recontagem realizada","obrigatorio":true},
  {"ordem":3,"item":"Resultado registrado","obrigatorio":true}]',
'[]'),

(7, 9, 'POP-SEG-EMP-001', '3.0', 'Checklist pré-operacional da empilhadeira',
$md$## Objetivo
Garantir condições seguras do equipamento antes do turno (NR-11).

## Passo a passo
1. Inspecionar visualmente garfos, correntes e mastro.
2. Testar **freio, buzina, luzes e alarme de ré**.
3. Verificar nível da bateria/gás.
4. Qualquer item reprovado: **não operar** e etiquetar como "fora de uso".$md$,
'[{"ordem":1,"item":"Garfos e correntes OK","obrigatorio":true},
  {"ordem":2,"item":"Freio e buzina OK","obrigatorio":true},
  {"ordem":3,"item":"Luzes e alarme de ré OK","obrigatorio":true},
  {"ordem":4,"item":"Bateria/gás OK","obrigatorio":true}]',
'[]');

-- Ajusta as sequences após inserir IDs explícitos ------------------------------
SELECT setval(pg_get_serial_sequence('empresas','id'),           (SELECT max(id) FROM empresas));
SELECT setval(pg_get_serial_sequence('departamentos','id'),      (SELECT max(id) FROM departamentos));
SELECT setval(pg_get_serial_sequence('cargos','id'),             (SELECT max(id) FROM cargos));
SELECT setval(pg_get_serial_sequence('entregaveis','id'),        (SELECT max(id) FROM entregaveis));
SELECT setval(pg_get_serial_sequence('atividades','id'),         (SELECT max(id) FROM atividades));
SELECT setval(pg_get_serial_sequence('pops_passo_a_passo','id'), (SELECT max(id) FROM pops_passo_a_passo));

COMMIT;
