import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const farms = sqliteTable("farms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  totalArea: real("total_area").notNull(),
  ...timestamps,
});

export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: integer("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: real("size").notNull(),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [index("areas_farm_id_idx").on(table.farmId), uniqueIndex("areas_farm_name_idx").on(table.farmId, table.name)]);

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
}, (table) => [index("tasks_farm_id_idx").on(table.farmId), index("tasks_farm_status_due_date_idx").on(table.farmId, table.status, table.dueDate)]);
