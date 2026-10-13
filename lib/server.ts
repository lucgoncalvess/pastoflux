import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { areas, farms, tasks } from "@/db/schema";
import { areaWarning, parseArea, parseFarm, parseTask } from "@/lib/domain-validation";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const status = /obrigatório|maior que zero|inválid|não encontrada|não encontrado/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

export function idFromUrl(request: Request) {
  const value = Number(new URL(request.url).pathname.split("/").pop());
  if (!Number.isInteger(value) || value < 1) throw new Error("Identificador inválido.");
  return value;
}

export async function farmForId(id: number) {
  const [farm] = await getDb().select().from(farms).where(eq(farms.id, id));
  if (!farm) throw new Error("Fazenda não encontrada.");
  return farm;
}

export async function createFarm(request: Request) {
  const values = parseFarm(await request.json());
  const [farm] = await getDb().insert(farms).values(values).returning();
  return Response.json({ farm }, { status: 201 });
}

export async function updateFarm(request: Request) {
  const id = idFromUrl(request);
  const values = parseFarm(await request.json());
  await farmForId(id);
  const [farm] = await getDb().update(farms).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(farms.id, id)).returning();
  return Response.json({ farm });
}

export async function createArea(request: Request) {
  const payload = await request.json();
  const farmId = Number(payload.farmId);
  const farm = await farmForId(farmId);
  const values = parseArea(payload);
  const existing = await getDb().select().from(areas).where(eq(areas.farmId, farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size);
  const [area] = await getDb().insert(areas).values({ ...values, farmId }).returning();
  return Response.json({ area, warning }, { status: 201 });
}

export async function updateArea(request: Request) {
  const id = idFromUrl(request);
  const payload = await request.json();
  const [current] = await getDb().select().from(areas).where(eq(areas.id, id));
  if (!current) throw new Error("Área não encontrada.");
  const farm = await farmForId(current.farmId);
  const values = parseArea(payload);
  const existing = await getDb().select().from(areas).where(eq(areas.farmId, current.farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size, id);
  const [area] = await getDb().update(areas).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(areas.id, id)).returning();
  return Response.json({ area, warning });
}

export async function createTask(request: Request) {
  const payload = await request.json();
  const farmId = Number(payload.farmId);
  await farmForId(farmId);
  const [task] = await getDb().insert(tasks).values({ ...parseTask(payload), farmId }).returning();
  return Response.json({ task }, { status: 201 });
}

export async function updateTask(request: Request) {
  const id = idFromUrl(request);
  const [current] = await getDb().select().from(tasks).where(eq(tasks.id, id));
  if (!current) throw new Error("Tarefa não encontrada.");
  const [task] = await getDb().update(tasks).set({ ...parseTask(await request.json()), updatedAt: new Date().toISOString() }).where(eq(tasks.id, id)).returning();
  return Response.json({ task });
}

export async function listAreas(farmId: number) { return getDb().select().from(areas).where(eq(areas.farmId, farmId)).orderBy(asc(areas.name)); }
export async function listTasks(farmId: number) { return getDb().select().from(tasks).where(eq(tasks.farmId, farmId)).orderBy(asc(tasks.dueDate), asc(tasks.id)); }
