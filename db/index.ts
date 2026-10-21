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
    "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE INDEX IF NOT EXISTS "tasks_farm_id_idx" ON "tasks" ("farm_id")`,
  `CREATE INDEX IF NOT EXISTS "tasks_farm_status_due_date_idx" ON "tasks" ("farm_id", "status", "due_date")`,
];

let initPromise: Promise<void> | null = null;

async function initializeSchema(db: typeof env.DB) {
  if (typeof db.prepare === "function") {
    for (const sql of SCHEMA_STATEMENTS) {
      await db.prepare(sql).run();
    }
  }
}

export async function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding \`DB\` is unavailable. Set the \`d1\` field in .openai/hosting.json to \`DB\` or let your control plane inject the real binding values before using the database."
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
