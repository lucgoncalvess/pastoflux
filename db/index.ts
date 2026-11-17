import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "farms" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "name" text NOT NULL,
    "total_area" real NOT NULL,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "areas" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "farm_id" integer NOT NULL,
    "name" text NOT NULL,
    "size" real NOT NULL,
    "max_capacity" integer DEFAULT 0 NOT NULL,
    "notes" text DEFAULT '' NOT NULL,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX IF NOT EXISTS "areas_farm_id_idx" ON "areas" ("farm_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "areas_farm_name_idx" ON "areas" ("farm_id", "name")`,
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "farm_id" integer NOT NULL,
    "title" text NOT NULL,
    "type" text NOT NULL,
    "lote" text DEFAULT '' NOT NULL,
    "origin" text,
    "destination" text,
    "due_date" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "details" text DEFAULT '' NOT NULL,
    "source_alert_id" integer,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX IF NOT EXISTS "tasks_farm_id_idx" ON "tasks" ("farm_id")`,
  `CREATE INDEX IF NOT EXISTS "tasks_farm_status_due_date_idx" ON "tasks" ("farm_id", "status", "due_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "tasks_source_alert_idx" ON "tasks" ("source_alert_id")`,
  `CREATE TABLE IF NOT EXISTS "animals" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer NOT NULL, "identification" text NOT NULL, "category" text NOT NULL, "sex" text DEFAULT 'unknown' NOT NULL, "weight" real, "birth_date" text, "active" integer DEFAULT 1 NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade)`,
  `CREATE INDEX IF NOT EXISTS "animals_farm_id_idx" ON "animals" ("farm_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "animals_farm_identification_idx" ON "animals" ("farm_id", "identification")`,
  `CREATE TABLE IF NOT EXISTS "user_farms" ("user_id" text NOT NULL, "farm_id" integer NOT NULL, "role" text DEFAULT 'owner' NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_farms_user_farm_idx" ON "user_farms" ("user_id", "farm_id")`,
  `CREATE INDEX IF NOT EXISTS "user_farms_farm_idx" ON "user_farms" ("farm_id")`,
  `CREATE TABLE IF NOT EXISTS "lots" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer NOT NULL, "name" text NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade)`,
  `CREATE INDEX IF NOT EXISTS "lots_farm_id_idx" ON "lots" ("farm_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "lots_farm_name_idx" ON "lots" ("farm_id", "name")`,
  `CREATE TABLE IF NOT EXISTS "animal_lots" ("animal_id" integer NOT NULL, "lot_id" integer NOT NULL, FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE cascade, FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE cascade)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "animal_lots_animal_idx" ON "animal_lots" ("animal_id")`,
  `CREATE INDEX IF NOT EXISTS "animal_lots_lot_idx" ON "animal_lots" ("lot_id")`,
  `CREATE TABLE IF NOT EXISTS "movements" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer NOT NULL, "lot_id" integer NOT NULL, "origin" text, "destination" text NOT NULL, "origin_area_id" integer, "destination_area_id" integer, "moved_at" text NOT NULL, "quantity" integer NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade, FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE cascade, FOREIGN KEY ("origin_area_id") REFERENCES "areas"("id") ON DELETE set null, FOREIGN KEY ("destination_area_id") REFERENCES "areas"("id") ON DELETE set null)`,
  `CREATE INDEX IF NOT EXISTS "movements_farm_date_idx" ON "movements" ("farm_id", "moved_at")`,
  `CREATE TABLE IF NOT EXISTS "pasture_measurements" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer NOT NULL, "area_id" integer NOT NULL, "measured_at" text NOT NULL, "availability" real NOT NULL, "source" text NOT NULL, "notes" text DEFAULT '' NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade, FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE cascade)`,
  `CREATE INDEX IF NOT EXISTS "pasture_measurements_area_date_idx" ON "pasture_measurements" ("area_id", "measured_at")`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer, "actor_id" text NOT NULL, "action" text NOT NULL, "entity" text NOT NULL, "entity_id" integer, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade)`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_farm_date_idx" ON "audit_logs" ("farm_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "occupations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "farm_id" integer NOT NULL, "area_id" integer NOT NULL, "lot_id" integer NOT NULL, "started_at" text NOT NULL, "ended_at" text, "recovery_days" integer DEFAULT 0 NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade, FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE cascade, FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE cascade)`,
  `CREATE INDEX IF NOT EXISTS "occupations_area_dates_idx" ON "occupations" ("area_id", "started_at", "ended_at")`,
  `CREATE INDEX IF NOT EXISTS "occupations_farm_idx" ON "occupations" ("farm_id")`,
  `CREATE TABLE IF NOT EXISTS "rental_offers" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "farm_id" integer NOT NULL,
    "area_id" integer NOT NULL,
    "region" text NOT NULL,
    "capacity_novilho" integer NOT NULL,
    "capacity_medio" integer NOT NULL,
    "capacity_grande" integer NOT NULL,
    "monthly_rate_novilho" real NOT NULL,
    "monthly_rate_medio" real NOT NULL,
    "monthly_rate_grande" real NOT NULL,
    "contact" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "status" text DEFAULT 'published' NOT NULL,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade,
    FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE cascade
  )`,
  `CREATE INDEX IF NOT EXISTS "rental_offers_search_idx" ON "rental_offers" ("status", "region", "capacity_medio")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rental_offers_area_active_idx" ON "rental_offers" ("area_id", "status")`,
  `CREATE TABLE IF NOT EXISTS "rental_contact_requests" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "offer_id" integer NOT NULL,
    "requester_id" text NOT NULL,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("offer_id") REFERENCES "rental_offers"("id") ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rental_contact_requests_offer_requester_idx" ON "rental_contact_requests" ("offer_id", "requester_id")`,
  `CREATE TABLE IF NOT EXISTS "alerts" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "farm_id" integer NOT NULL,
    "area_id" integer,
    "occupation_id" integer,
    "type" text NOT NULL,
    "title" text NOT NULL,
    "message" text NOT NULL,
    "due_date" text NOT NULL,
    "dedupe_key" text NOT NULL,
    "read_at" text,
    "task_id" integer,
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE cascade,
    FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE cascade,
    FOREIGN KEY ("occupation_id") REFERENCES "occupations"("id") ON DELETE cascade,
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null
  )`,
  `CREATE INDEX IF NOT EXISTS "alerts_farm_due_date_idx" ON "alerts" ("farm_id", "due_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "alerts_dedupe_key_idx" ON "alerts" ("dedupe_key")`,
];

let initPromise: Promise<void> | null = null;

async function initializeSchema(db: typeof env.DB) {
  if (typeof db.prepare === "function") {
    for (const sql of SCHEMA_STATEMENTS) {
      await db.prepare(sql).run();
    }
    const animalColumns = await db.prepare(`PRAGMA table_info("animals")`).all<{ name: string }>();
    if (!animalColumns.results.some((column) => column.name === "sex")) {
      await db.prepare(`ALTER TABLE "animals" ADD COLUMN "sex" text DEFAULT 'unknown' NOT NULL`).run();
    }
  }
}

export async function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  if (!initPromise) {
    initPromise = initializeSchema(env.DB).catch((err) => {
      initPromise = null;
      console.error("Falha ao inicializar o esquema do banco de dados:", err);
      throw err;
    });
  }

  await initPromise;

  return drizzle(env.DB, { schema });
}
