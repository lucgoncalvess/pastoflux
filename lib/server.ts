import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { areas, farms, tasks } from "@/db/schema";
import { areaWarning, parseArea, parseFarm, parseTask } from "@/lib/domain-validation";

/**
 * Utilitário para padronização de respostas de erro da API.
 * Mapeia erros de validação de negócio para HTTP 400 (Bad Request)
 * e outros erros inesperados para HTTP 500 (Internal Server Error).
 */
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const status = /obrigatório|maior que zero|inválid|não encontrada|não encontrado/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

/**
 * Extrai e valida o ID numérico a partir do final da URL da requisição (ex.: /api/farms/1 -> 1).
 */
export function idFromUrl(request: Request) {
  const value = Number(new URL(request.url).pathname.split("/").pop());
  if (!Number.isInteger(value) || value < 1) throw new Error("Identificador inválido.");
  return value;
}

/**
 * Busca uma fazenda pelo ID ou lança erro se não existir.
 * Garante a integridade referencial nas rotas filhas (áreas e tarefas).
 */
export async function farmForId(id: number) {
  const db = await getDb();
  const [farm] = await db.select().from(farms).where(eq(farms.id, id));
  if (!farm) throw new Error("Fazenda não encontrada.");
  return farm;
}

/**
 * Cria uma nova fazenda no banco D1 após validar os campos com parseFarm.
 */
export async function createFarm(request: Request) {
  const values = parseFarm(await request.json());
  const db = await getDb();
  const [farm] = await db.insert(farms).values(values).returning();
  return Response.json({ farm }, { status: 201 });
}

/**
 * Atualiza o nome ou área de uma fazenda existente e atualiza o timestamp updatedAt.
 */
export async function updateFarm(request: Request) {
  const id = idFromUrl(request);
  const values = parseFarm(await request.json());
  await farmForId(id);
  const db = await getDb();
  const [farm] = await db.update(farms).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(farms.id, id)).returning();
  return Response.json({ farm });
}

/**
 * Cadastra uma nova área (piquete/pasto) vinculada a uma fazenda.
 * Executa a regra areaWarning para alertar se a soma das áreas superou a área total da fazenda.
 */
export async function createArea(request: Request) {
  const payload = await request.json();
  const farmId = Number(payload.farmId);
  const farm = await farmForId(farmId);
  const values = parseArea(payload);
  const db = await getDb();
  const existing = await db.select().from(areas).where(eq(areas.farmId, farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size);
  const [area] = await db.insert(areas).values({ ...values, farmId }).returning();
  return Response.json({ area, warning }, { status: 201 });
}

/**
 * Atualiza dados de uma área existente e recalcula o aviso de limite de área da fazenda.
 */
export async function updateArea(request: Request) {
  const id = idFromUrl(request);
  const payload = await request.json();
  const db = await getDb();
  const [current] = await db.select().from(areas).where(eq(areas.id, id));
  if (!current) throw new Error("Área não encontrada.");
  const farm = await farmForId(current.farmId);
  const values = parseArea(payload);
  const existing = await db.select().from(areas).where(eq(areas.farmId, current.farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size, id);
  const [area] = await db.update(areas).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(areas.id, id)).returning();
  return Response.json({ area, warning });
}

/**
 * Cria uma tarefa na agenda de manejo associada à fazenda ativa.
 */
export async function createTask(request: Request) {
  const payload = await request.json();
  const farmId = Number(payload.farmId);
  await farmForId(farmId);
  const db = await getDb();
  const [task] = await db.insert(tasks).values({ ...parseTask(payload), farmId }).returning();
  return Response.json({ task }, { status: 201 });
}

/**
 * Atualiza o status (concluir/reabrir), data ou detalhes de uma tarefa na agenda.
 */
export async function updateTask(request: Request) {
  const id = idFromUrl(request);
  const db = await getDb();
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!current) throw new Error("Tarefa não encontrada.");
  const [task] = await db.update(tasks).set({ ...parseTask(await request.json()), updatedAt: new Date().toISOString() }).where(eq(tasks.id, id)).returning();
  return Response.json({ task });
}

/**
 * Lista todas as áreas cadastradas de uma fazenda ordenadas alfabeticamente por nome.
 */
export async function listAreas(farmId: number) {
  const db = await getDb();
  return db.select().from(areas).where(eq(areas.farmId, farmId)).orderBy(asc(areas.name));
}

/**
 * Lista todas as tarefas de manejo da fazenda ordenadas cronologicamente pela data prevista.
 */
export async function listTasks(farmId: number) {
  const db = await getDb();
  return db.select().from(tasks).where(eq(tasks.farmId, farmId)).orderBy(asc(tasks.dueDate), asc(tasks.id));
}

