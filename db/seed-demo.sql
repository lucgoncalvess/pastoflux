-- Seed de demonstração: Fazenda Santa Clara (apenas para avaliação)
-- Reexecutável: remove a fazenda demo (cascade) antes de recriar.
DELETE FROM farms WHERE id = 9001;
DELETE FROM user_farms WHERE farm_id = 9001;

INSERT INTO farms (id, name, total_area) VALUES (9001, 'Fazenda Santa Clara', 420.0);

-- Código de acesso da demo (informar na tela de acesso em outro aparelho)
INSERT INTO user_farms (user_id, farm_id, role) VALUES
  ('11111111-2222-3333-4444-555555555555', 9001, 'owner');

-- Piquetes
INSERT INTO areas (id, farm_id, name, size, max_capacity, notes) VALUES
  (9011, 9001, 'Piquete Sede',     85.0, 70, 'Brachiaria brizantha, aguada boa'),
  (9012, 9001, 'Piquete Baixada',  62.5, 50, 'Em recuperação após pastejo'),
  (9013, 9001, 'Piquete Córrego',  98.0, 80, 'Disponível'),
  (9014, 9001, 'Piquete Cerrado', 110.0, 90, 'Área ofertada para aluguel'),
  (9015, 9001, 'Piquete Maternidade', 40.0, 30, 'Vacas paridas');

-- Lotes
INSERT INTO lots (id, farm_id, name) VALUES
  (9021, 9001, 'Lote Recria 2026'),
  (9022, 9001, 'Lote Engorda'),
  (9023, 9001, 'Lote Matrizes');

-- Animais
INSERT INTO animals (id, farm_id, identification, category, sex, weight, birth_date, area_id, active) VALUES
  (9101, 9001, 'SC-0001', 'Novilho',  'male',   285.0, '2025-03-10', 9011, 1),
  (9102, 9001, 'SC-0002', 'Novilho',  'male',   298.5, '2025-03-18', 9011, 1),
  (9103, 9001, 'SC-0003', 'Novilho',  'male',   272.0, '2025-04-02', 9011, 1),
  (9104, 9001, 'SC-0004', 'Novilha',  'female', 261.0, '2025-04-11', 9011, 1),
  (9105, 9001, 'SC-0005', 'Novilha',  'female', 255.5, '2025-05-01', 9011, 1),
  (9106, 9001, 'SC-0006', 'Boi gordo','male',   482.0, '2024-02-14', 9013, 1),
  (9107, 9001, 'SC-0007', 'Boi gordo','male',   496.5, '2024-02-20', 9013, 1),
  (9108, 9001, 'SC-0008', 'Boi gordo','male',   510.0, '2024-03-05', 9013, 1),
  (9109, 9001, 'SC-0009', 'Boi gordo','male',   468.0, '2024-03-22', 9013, 1),
  (9110, 9001, 'SC-0010', 'Matriz',   'female', 445.0, '2022-06-15', 9015, 1),
  (9111, 9001, 'SC-0011', 'Matriz',   'female', 452.5, '2022-07-02', 9015, 1),
  (9112, 9001, 'SC-0012', 'Matriz',   'female', 438.0, '2022-08-19', 9015, 1);

INSERT INTO animal_lots (animal_id, lot_id) VALUES
  (9101, 9021), (9102, 9021), (9103, 9021), (9104, 9021), (9105, 9021),
  (9106, 9022), (9107, 9022), (9108, 9022), (9109, 9022),
  (9110, 9023), (9111, 9023), (9112, 9023);

-- Ocupações: em uso, encerrada em recuperação e histórico
INSERT INTO occupations (id, farm_id, area_id, lot_id, started_at, ended_at, recovery_days) VALUES
  (9031, 9001, 9011, 9021, '2026-11-18', NULL,         30),
  (9032, 9001, 9012, 9022, '2026-10-15', '2026-11-12', 30),
  (9033, 9001, 9013, 9022, '2026-11-14', NULL,         25),
  (9034, 9001, 9015, 9023, '2026-09-01', '2026-10-20', 21);

-- Movimentações
INSERT INTO movements (farm_id, lot_id, origin, destination, origin_area_id, destination_area_id, moved_at, quantity) VALUES
  (9001, 9022, 'Piquete Baixada', 'Piquete Córrego', 9012, 9013, '2026-11-14', 4),
  (9001, 9021, NULL,              'Piquete Sede',    NULL,  9011, '2026-11-18', 5),
  (9001, 9023, 'Piquete Maternidade', 'Piquete Maternidade', 9015, 9015, '2026-10-20', 3);

-- Medições de disponibilidade de pasto (kg MS/ha)
INSERT INTO pasture_measurements (farm_id, area_id, measured_at, availability, source, notes) VALUES
  (9001, 9011, '2026-11-24', 2850.0, 'visual',   'Pasto em bom estado'),
  (9001, 9012, '2026-11-20', 1100.0, 'visual',   'Rebrota inicial'),
  (9001, 9013, '2026-11-22', 3200.0, 'régua',    'Entrada recente do lote'),
  (9001, 9014, '2026-11-10', 3400.0, 'régua',    'Área ociosa, ofertada');

-- Agenda de manejo
INSERT INTO tasks (farm_id, title, type, lote, origin, destination, due_date, status, details) VALUES
  (9001, 'Vacinação aftosa - Lote Recria', 'sanidade', 'Lote Recria 2026', NULL, NULL, '2026-12-02', 'pending', 'Dose conforme calendário estadual'),
  (9001, 'Remanejar Lote Engorda',          'manejo',   'Lote Engorda', 'Piquete Córrego', 'Piquete Cerrado', '2026-12-05', 'pending', 'Gerado pelo simulador'),
  (9001, 'Pesagem mensal',                  'pesagem',  'Lote Engorda', NULL, NULL, '2026-11-30', 'pending', ''),
  (9001, 'Adubação Piquete Baixada',        'pastagem', '', NULL, NULL, '2026-11-20', 'completed', '200 kg/ha de NPK'),
  (9001, 'Controle de carrapato',           'sanidade', 'Lote Matrizes', NULL, NULL, '2026-11-15', 'completed', '');

-- Alertas de manejo
INSERT INTO alerts (farm_id, area_id, occupation_id, type, title, message, due_date, dedupe_key) VALUES
  (9001, 9012, 9032, 'recovery_ended',  'Descanso concluído', 'Piquete Baixada completou o período de recuperação.', '2026-12-12', 'demo-sc-recovery-9032'),
  (9001, 9011, 9031, 'occupation_ended','Ocupação longa',     'Piquete Sede está ocupado há mais de 9 dias.',        '2026-12-01', 'demo-sc-occupation-9031'),
  (9001, 9015, NULL, 'capacity_exceeded','Capacidade próxima do limite', 'Piquete Maternidade perto da lotação máxima.', '2026-11-29', 'demo-sc-capacity-9015');

-- Oferta de aluguel de pasto ocioso
INSERT INTO rental_offers (farm_id, area_id, region, capacity_novilho, capacity_medio, capacity_grande,
                           monthly_rate_novilho, monthly_rate_medio, monthly_rate_grande, contact, description, status) VALUES
  (9001, 9014, 'Triângulo Mineiro - MG', 120, 90, 70, 48.0, 62.0, 78.0, '(34) 90000-0000', 'Pasto formado, cerca nova, água corrente o ano todo.', 'published');
