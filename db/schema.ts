import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Campos padrão de auditoria temporal (criação e atualização)
const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

/**
 * Tabela 'farms' (Fazendas / Propriedades):
 * Entidade raiz do domínio do PastoFlux.
 * Armazena a identificação e a área total em hectares da propriedade.
 */
export const farms = sqliteTable("farms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  totalArea: real("total_area").notNull(),
  ...timestamps,
});

export const animals = sqliteTable("animals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  identification: text("identification").notNull(),
  category: text("category").notNull(),
  weight: real("weight"),
  birthDate: text("birth_date"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("animals_farm_id_idx").on(table.farmId),
  uniqueIndex("animals_farm_identification_idx").on(table.farmId, table.identification),
]);

export const userFarms = sqliteTable("user_farms", {
  userId: text("user_id").notNull(),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "manager", "viewer"] }).notNull().default("owner"),
}, (table) => [
  uniqueIndex("user_farms_user_farm_idx").on(table.userId, table.farmId),
  index("user_farms_farm_idx").on(table.farmId),
]);

export const lots = sqliteTable("lots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("lots_farm_id_idx").on(table.farmId),
  uniqueIndex("lots_farm_name_idx").on(table.farmId, table.name),
]);

export const animalLots = sqliteTable("animal_lots", {
  animalId: integer("animal_id").notNull().references(() => animals.id, { onDelete: "cascade" }),
  lotId: integer("lot_id").notNull().references(() => lots.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("animal_lots_animal_idx").on(table.animalId),
  index("animal_lots_lot_idx").on(table.lotId),
]);

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  lotId: integer("lot_id").notNull().references(() => lots.id, { onDelete: "cascade" }),
  origin: text("origin"),
  destination: text("destination").notNull(),
  originAreaId: integer("origin_area_id").references(() => areas.id, { onDelete: "set null" }),
  destinationAreaId: integer("destination_area_id").references(() => areas.id, { onDelete: "set null" }),
  movedAt: text("moved_at").notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("movements_farm_date_idx").on(table.farmId, table.movedAt),
]);

export const occupations = sqliteTable("occupations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  areaId: integer("area_id").notNull().references(() => areas.id, { onDelete: "cascade" }),
  lotId: integer("lot_id").notNull().references(() => lots.id, { onDelete: "cascade" }),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  recoveryDays: integer("recovery_days").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("occupations_area_dates_idx").on(table.areaId, table.startedAt, table.endedAt),
  index("occupations_farm_idx").on(table.farmId),
]);

export const pastureMeasurements = sqliteTable("pasture_measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  areaId: integer("area_id").notNull().references(() => areas.id, { onDelete: "cascade" }),
  measuredAt: text("measured_at").notNull(),
  availability: real("availability").notNull(),
  source: text("source").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("pasture_measurements_area_date_idx").on(table.areaId, table.measuredAt),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").references(() => farms.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("audit_logs_farm_date_idx").on(table.farmId, table.createdAt),
]);

/**
 * Tabela 'areas' (Piquetes / Pastagens da Fazenda):
 * Possui chave estrangeira farm_id com deleção em cascata (se a fazenda for excluída, suas áreas também são).
 * Índices:
 * - areas_farm_id_idx: acelera a listagem de áreas por fazenda.
 * - areas_farm_name_idx: garante unicidade de nome de área dentro da mesma fazenda.
 */
export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: real("size").notNull(),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [
  index("areas_farm_id_idx").on(table.farmId),
  uniqueIndex("areas_farm_name_idx").on(table.farmId, table.name),
]);

/**
 * Tabela 'tasks' (Atividades da Agenda de Manejo):
 * Vinculada à fazenda (farm_id com onDelete cascade).
 * Armazena título, categoria de manejo, lote, movimentação (origem/destino), data e status.
 * Índices:
 * - tasks_farm_id_idx: busca rápida de tarefas da fazenda.
 * - tasks_farm_status_due_date_idx: índice composto para ordenação por status e data de vencimento.
 */
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  lote: text("lote").notNull().default(""),
  origin: text("origin"),
  destination: text("destination"),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["pending", "completed"] }).notNull().default("pending"),
  details: text("details").notNull().default(""),
  ...timestamps,
}, (table) => [
  index("tasks_farm_id_idx").on(table.farmId),
  index("tasks_farm_status_due_date_idx").on(table.farmId, table.status, table.dueDate),
]);
