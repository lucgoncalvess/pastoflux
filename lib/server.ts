import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { alerts, animalLots, animals, areas, auditLogs, farms, lots, movements, occupations, pastureMeasurements, rentalContactRequests, rentalOffers, tasks, userFarms } from "@/db/schema";
import { areaWarning, isCapacityExceeded, parseAnimal, parseArea, parseFarm, parseLot, parseMeasurement, parseMovement, parseRentalOffer, parseTask, recoveryEndDate } from "@/lib/domain-validation";

/**
 * O D1 limita cada consulta a 100 parâmetros vinculados.
 * Um animal usa 8 parâmetros no INSERT (12 × 8 = 96); a busca por identificação usa 1 por item + farmId.
 */
const D1_ANIMAL_INSERT_CHUNK = 12;
const D1_LOOKUP_CHUNK = 90;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Corpo JSON das requisições, validado depois pelas funções parse* do domínio. */
type JsonBody = Record<string, unknown>;

async function readJson(request: Request): Promise<JsonBody> {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Corpo da requisição inválido.");
  return body as JsonBody;
}

/**
 * Utilitário para padronização de respostas de erro da API.
 * Mapeia erros de validação de negócio para HTTP 400 (Bad Request)
 * e outros erros inesperados para HTTP 500 (Internal Server Error).
 */
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const status = /autenticação obrigatória/i.test(message) ? 401 : /obrigatório|maior que zero|inválid|não encontrada|não encontrado|não possui animais|já existe|já possui|devem ser únicas|informe ao menos|entre 0 e 100|não pode ser publicada|sem permissão|não autorizado|x-farm-id/i.test(message) ? 400 : 500;
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

export function actorFromRequest(request: Request) {
  const actor = request.headers.get("oai-authenticated-user-id") ?? request.headers.get("x-pastoflux-user-id");
  const local = new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1";
  if (actor) return actor;
  if (local) return "local-development";
  throw new Error("Autenticação obrigatória para alterar dados.");
}

export async function requireFarmAccess(request: Request, farmId: number, write = false) {
  const requested = Number(request.headers.get("x-farm-id"));
  if (!Number.isInteger(requested) || requested !== farmId) throw new Error("X-Farm-ID é obrigatório e deve corresponder à fazenda ativa.");
  const actor = actorFromRequest(request);
  const db = await getDb();
  const [membership] = await db.select().from(userFarms).where(and(eq(userFarms.userId, actor), eq(userFarms.farmId, farmId)));
  if (!membership && actor !== "local-development") throw new Error("Acesso não autorizado para esta fazenda.");
  if (write && membership?.role === "viewer") throw new Error("Perfil sem permissão de escrita.");
  return actor;
}

async function audit(request: Request, farmId: number | null, action: string, entity: string, entityId?: number) {
  const db = await getDb();
  await db.insert(auditLogs).values({ farmId, actorId: actorFromRequest(request), action, entity, entityId });
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

export async function listFarms(request: Request) {
  const actor = actorFromRequest(request);
  const db = await getDb();
  if (actor === "local-development") return db.select().from(farms).orderBy(asc(farms.name));
  return db.select({ id: farms.id, name: farms.name, totalArea: farms.totalArea, createdAt: farms.createdAt, updatedAt: farms.updatedAt })
    .from(farms).innerJoin(userFarms, eq(userFarms.farmId, farms.id)).where(eq(userFarms.userId, actor)).orderBy(asc(farms.name));
}

/**
 * Cria uma nova fazenda no banco D1 após validar os campos com parseFarm.
 */
export async function createFarm(request: Request) {
  actorFromRequest(request);
  const values = parseFarm(await readJson(request));
  const db = await getDb();
  const [farm] = await db.insert(farms).values(values).returning();
  await db.insert(userFarms).values({ userId: actorFromRequest(request), farmId: farm.id, role: "owner" });
  await audit(request, farm.id, "create", "farm", farm.id);
  return Response.json({ farm }, { status: 201 });
}

/**
 * Atualiza o nome ou área de uma fazenda existente e atualiza o timestamp updatedAt.
 */
export async function updateFarm(request: Request) {
  actorFromRequest(request);
  const id = idFromUrl(request);
  const values = parseFarm(await readJson(request));
  await farmForId(id);
  await requireFarmAccess(request, id, true);
  const db = await getDb();
  const [farm] = await db.update(farms).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(farms.id, id)).returning();
  await audit(request, farm.id, "update", "farm", farm.id);
  return Response.json({ farm });
}

/**
 * Cadastra uma nova área (piquete/pasto) vinculada a uma fazenda.
 * Executa a regra areaWarning para alertar se a soma das áreas superou a área total da fazenda.
 */
export async function createArea(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  await requireFarmAccess(request, farmId, true);
  const farm = await farmForId(farmId);
  const values = parseArea(payload);
  const db = await getDb();
  const existing = await db.select().from(areas).where(eq(areas.farmId, farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size);
  await db.insert(areas).values({ ...values, farmId }).run();
  const [area] = await db.select().from(areas).where(and(eq(areas.farmId, farmId), eq(areas.name, values.name)));
  if (!area) throw new Error("Não foi possível salvar a área.");
  await audit(request, farmId, "create", "area", area.id);
  return Response.json({ area, warning }, { status: 201 });
}

/**
 * Atualiza dados de uma área existente e recalcula o aviso de limite de área da fazenda.
 */
export async function updateArea(request: Request) {
  actorFromRequest(request);
  const id = idFromUrl(request);
  const payload = await readJson(request);
  const db = await getDb();
  const [current] = await db.select().from(areas).where(eq(areas.id, id));
  if (!current) throw new Error("Área não encontrada.");
  await requireFarmAccess(request, current.farmId, true);
  const farm = await farmForId(current.farmId);
  const values = parseArea(payload);
  const existing = await db.select().from(areas).where(eq(areas.farmId, current.farmId));
  const warning = areaWarning(farm.totalArea, existing, values.size, id);
  const [area] = await db.update(areas).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(areas.id, id)).returning();
  await audit(request, current.farmId, "update", "area", area.id);
  return Response.json({ area, warning });
}

/**
 * Cria uma tarefa na agenda de manejo associada à fazenda ativa.
 */
export async function createTask(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const db = await getDb();
  const [task] = await db.insert(tasks).values({ ...parseTask(payload), farmId }).returning();
  await audit(request, farmId, "create", "task", task.id);
  return Response.json({ task }, { status: 201 });
}

/**
 * Atualiza o status (concluir/reabrir), data ou detalhes de uma tarefa na agenda.
 */
export async function updateTask(request: Request) {
  actorFromRequest(request);
  const id = idFromUrl(request);
  const db = await getDb();
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!current) throw new Error("Tarefa não encontrada.");
  await requireFarmAccess(request, current.farmId, true);
  const [task] = await db.update(tasks).set({ ...parseTask(await readJson(request)), updatedAt: new Date().toISOString() }).where(eq(tasks.id, id)).returning();
  await audit(request, current.farmId, "update", "task", task.id);
  return Response.json({ task });
}

export async function listAnimals(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  return db.select().from(animals).where(eq(animals.farmId, farmId)).orderBy(asc(animals.identification));
}

export async function createAnimal(request: Request) {
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  actorFromRequest(request);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const db = await getDb();
  const inputs = Array.isArray(payload.animals) ? payload.animals : [payload];
  if (!inputs.length) throw new Error("Informe ao menos um animal.");
  const values = inputs.map(parseAnimal);
  const identifications = values.map((value) => value.identification);
  if (new Set(identifications).size !== identifications.length) throw new Error("As identificações dos animais devem ser únicas.");
  // O D1 aceita no máximo 100 parâmetros por consulta: consultas e inserções são feitas em blocos.
  const existing = (await Promise.all(chunk(identifications, D1_LOOKUP_CHUNK).map((ids) =>
    db.select({ identification: animals.identification }).from(animals).where(and(eq(animals.farmId, farmId), inArray(animals.identification, ids))),
  ))).flat();
  if (existing.length) throw new Error(`Já existe animal com a identificação ${existing[0].identification}.`);
  const [firstInsert, ...otherInserts] = chunk(values, D1_ANIMAL_INSERT_CHUNK).map((rows) => db.insert(animals).values(rows.map((value) => ({ ...value, farmId }))));
  // db.batch é atômico no D1: ou todos os blocos são gravados, ou nenhum.
  await db.batch([firstInsert, ...otherInserts]);
  const created = (await Promise.all(chunk(identifications, D1_LOOKUP_CHUNK).map((ids) =>
    db.select().from(animals).where(and(eq(animals.farmId, farmId), inArray(animals.identification, ids))),
  ))).flat();
  for (const animal of created) await audit(request, farmId, "create", "animal", animal.id);
  return inputs.length === 1 ? Response.json({ animal: created[0] }, { status: 201 }) : Response.json({ animals: created }, { status: 201 });
}

export async function updateAnimal(request: Request) {
  actorFromRequest(request);
  const id = idFromUrl(request);
  const db = await getDb();
  const [current] = await db.select().from(animals).where(eq(animals.id, id));
  if (!current) throw new Error("Animal não encontrado.");
  await requireFarmAccess(request, current.farmId, true);
  const [animal] = await db.update(animals).set({ ...parseAnimal(await readJson(request)), updatedAt: new Date().toISOString() }).where(eq(animals.id, id)).returning();
  await audit(request, current.farmId, "update", "animal", id);
  return Response.json({ animal });
}

export async function listLots(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  return db
    .select({ id: lots.id, farmId: lots.farmId, name: lots.name, animalCount: sql<number>`count(${animalLots.animalId})` })
    .from(lots)
    .leftJoin(animalLots, eq(animalLots.lotId, lots.id))
    .where(eq(lots.farmId, farmId))
    .groupBy(lots.id)
    .orderBy(asc(lots.name));
}

/** Animais vinculados ao lote (tabela animal_lots). */
async function lotAnimalIds(db: Awaited<ReturnType<typeof getDb>>, lotId: number) {
  const rows = await db.select({ animalId: animalLots.animalId }).from(animalLots).where(eq(animalLots.lotId, lotId));
  return rows.map((row) => row.animalId);
}

export async function createLot(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const db = await getDb();
  const [lot] = await db.insert(lots).values({ ...parseLot(payload), farmId }).returning();
  const animalIds = Array.isArray(payload.animalIds) ? payload.animalIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0) : [];
  if (animalIds.length) {
    const owned = await db.select().from(animals).where(eq(animals.farmId, farmId));
    const ownedIds = new Set(owned.map((animal) => animal.id));
    for (const animalId of animalIds) {
      if (ownedIds.has(animalId)) {
        await db.delete(animalLots).where(eq(animalLots.animalId, animalId));
        await db.insert(animalLots).values({ animalId, lotId: lot.id });
      }
    }
  }
  await audit(request, farmId, "create", "lot", lot.id);
  const animalCount = (await lotAnimalIds(db, lot.id)).length;
  return Response.json({ lot: { id: lot.id, farmId: lot.farmId, name: lot.name, animalCount } }, { status: 201 });
}

export async function listMovements(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  return db.select().from(movements).where(eq(movements.farmId, farmId)).orderBy(desc(movements.movedAt));
}

export async function createMovement(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const db = await getDb();
  // A quantidade vem dos animais vinculados ao lote, não do valor enviado pelo cliente.
  const lotAnimals = await lotAnimalIds(db, Number(payload.lotId));
  if (!lotAnimals.length) throw new Error("O lote não possui animais vinculados. Crie o lote selecionando os animais.");
  const values = parseMovement({ ...payload, quantity: lotAnimals.length });
  const [lot] = await db.select().from(lots).where(eq(lots.id, values.lotId));
  if (!lot || lot.farmId !== farmId) throw new Error("Lote não encontrado.");
  const [originArea] = values.originAreaId ? await db.select().from(areas).where(and(eq(areas.id, values.originAreaId), eq(areas.farmId, farmId))) : [null];
  const [destinationArea] = await db.select().from(areas).where(and(eq(areas.id, values.destinationAreaId), eq(areas.farmId, farmId)));
  if (!destinationArea || (values.originAreaId && !originArea)) throw new Error("Área de movimentação não encontrada.");
  const destinationOccupations = await db.select().from(occupations).where(and(eq(occupations.areaId, values.destinationAreaId), eq(occupations.farmId, farmId)));
  const destinationDate = new Date(`${values.movedAt}T00:00:00`);
  const hasOverlap = destinationOccupations.some((occupation) => {
    if (occupation.lotId === values.lotId) return false;
    const start = new Date(`${occupation.startedAt}T00:00:00`);
    const end = occupation.endedAt ? new Date(`${occupation.endedAt}T00:00:00`) : null;
    return start <= destinationDate && (!end || end >= destinationDate);
  });
  if (hasOverlap) throw new Error("A área de destino já possui ocupação na data informada.");
  // O D1 não suporta BEGIN/COMMIT (db.transaction); db.batch executa tudo de forma atômica.
  const [, [newOccupation], , [created]] = await db.batch([
    db.update(occupations).set({ endedAt: values.movedAt }).where(and(
      values.originAreaId ? eq(occupations.areaId, values.originAreaId) : sql`0`,
      eq(occupations.lotId, values.lotId),
      isNull(occupations.endedAt),
    )),
    db.insert(occupations).values({
      farmId, areaId: values.destinationAreaId, lotId: values.lotId, startedAt: values.movedAt, recoveryDays: values.recoveryDays,
    }).returning(),
    // Os animais do lote passam a constar no piquete de destino.
    db.update(animals).set({ areaId: values.destinationAreaId, updatedAt: new Date().toISOString() }).where(and(eq(animals.farmId, farmId), inArray(animals.id, lotAnimals))),
    db.insert(movements).values({ ...values, farmId }).returning(),
  ]);
  const movement = { ...created, occupationId: newOccupation.id };
  await audit(request, farmId, "create", "movement", movement.id);
  return Response.json({ movement }, { status: 201 });
}

export async function listMeasurements(request: Request, areaId: number) {
  const db = await getDb();
  const [area] = await db.select().from(areas).where(eq(areas.id, areaId));
  if (!area) throw new Error("Área não encontrada.");
  await requireFarmAccess(request, area.farmId);
  return db.select().from(pastureMeasurements).where(eq(pastureMeasurements.areaId, areaId)).orderBy(desc(pastureMeasurements.measuredAt));
}

export async function createMeasurement(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  const areaId = Number(payload.areaId);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const [area] = await (await getDb()).select().from(areas).where(eq(areas.id, areaId));
  if (!area || area.farmId !== farmId) throw new Error("Área não encontrada.");
  const [measurement] = await (await getDb()).insert(pastureMeasurements).values({ ...parseMeasurement(payload), farmId, areaId }).returning();
  await audit(request, farmId, "create", "pasture_measurement", measurement.id);
  return Response.json({ measurement }, { status: 201 });
}

/**
 * Lista todas as áreas cadastradas de uma fazenda ordenadas alfabeticamente por nome.
 */
export async function listAreas(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  return db.select().from(areas).where(eq(areas.farmId, farmId)).orderBy(asc(areas.name));
}

export async function listFarmOccupations(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  const rows = await db.select().from(occupations).where(eq(occupations.farmId, farmId));
  const now = new Date();
  return rows.map((occupation) => {
    const start = new Date(`${occupation.startedAt}T00:00:00`);
    const end = occupation.endedAt ? new Date(`${occupation.endedAt}T00:00:00`) : null;
    const recoveryEnd = end ? new Date(end.getTime() + occupation.recoveryDays * 86400000) : null;
    const status = start > now ? "DISPONIVEL" : !end || end > now ? "EM_USO" : recoveryEnd && recoveryEnd > now ? "EM_RECUPERACAO" : "DISPONIVEL";
    return { ...occupation, status };
  });
}

export async function herdStats(request: Request, farmId: number, params: URLSearchParams) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  const filters = [eq(animals.farmId, farmId), eq(animals.active, true)];
  const category = params.get("category");
  if (category) filters.push(eq(animals.category, category));
  const [summary] = await db.select({
    heads: sql<number>`count(*)`,
    averageWeight: sql<number>`coalesce(avg(${animals.weight}), 0)`,
  }).from(animals).where(and(...filters));
  const categories = await db.select({ category: animals.category, heads: sql<number>`count(*)` }).from(animals).where(and(...filters)).groupBy(animals.category);
  return { ...summary, categories };
}

/**
 * Lista todas as tarefas de manejo da fazenda ordenadas cronologicamente pela data prevista.
 */
export async function listTasks(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  const db = await getDb();
  return db.select().from(tasks).where(eq(tasks.farmId, farmId)).orderBy(asc(tasks.dueDate), asc(tasks.id));
}

async function syncFarmAlerts(farmId: number) {
  const db = await getDb();
  const farmOccupations = await db.select().from(occupations).where(eq(occupations.farmId, farmId));
  const farmAreas = await db.select().from(areas).where(eq(areas.farmId, farmId));
  const farmMovements = await db.select().from(movements).where(eq(movements.farmId, farmId));
  const areaById = new Map(farmAreas.map((area) => [area.id, area]));
  for (const occupation of farmOccupations) {
    const area = areaById.get(occupation.areaId);
    if (!area) continue;
    const movement = farmMovements.find((item) => item.lotId === occupation.lotId && item.destinationAreaId === occupation.areaId && item.movedAt === occupation.startedAt);
    if (movement && isCapacityExceeded(movement.quantity, area.maxCapacity)) {
      await db.insert(alerts).values({
        farmId, areaId: area.id, occupationId: occupation.id, type: "capacity_exceeded",
        title: "Capacidade da área excedida",
        message: `${movement.quantity} animais ocupam ${area.name}, acima do limite de ${area.maxCapacity}.`,
        dueDate: occupation.startedAt,
        dedupeKey: `capacity_exceeded:${occupation.id}`,
      }).onConflictDoNothing({ target: alerts.dedupeKey });
    }
    if (occupation.endedAt) {
      await db.insert(alerts).values({
        farmId, areaId: area.id, occupationId: occupation.id, type: "occupation_ended",
        title: "Fim da ocupação",
        message: `A ocupação da área ${area.name} terminou em ${occupation.endedAt}.`,
        dueDate: occupation.endedAt,
        dedupeKey: `occupation_ended:${occupation.id}`,
      }).onConflictDoNothing({ target: alerts.dedupeKey });
      if (occupation.recoveryDays > 0) {
        const recoveryDate = recoveryEndDate(occupation.endedAt, occupation.recoveryDays);
        if (!recoveryDate) continue;
        await db.insert(alerts).values({
          farmId, areaId: area.id, occupationId: occupation.id, type: "recovery_ended",
          title: "Fim do período de recuperação",
          message: `A área ${area.name} concluiu a recuperação em ${recoveryDate}.`,
          dueDate: recoveryDate,
          dedupeKey: `recovery_ended:${occupation.id}`,
        }).onConflictDoNothing({ target: alerts.dedupeKey });
      }
    }
  }
}

export async function listAlerts(request: Request, farmId: number) {
  await requireFarmAccess(request, farmId);
  await syncFarmAlerts(farmId);
  const db = await getDb();
  return db.select().from(alerts).where(eq(alerts.farmId, farmId)).orderBy(desc(alerts.dueDate), desc(alerts.id));
}

export async function markAlertRead(request: Request, alertId: number) {
  const db = await getDb();
  const [current] = await db.select().from(alerts).where(eq(alerts.id, alertId));
  if (!current) throw new Error("Alerta não encontrado.");
  await requireFarmAccess(request, current.farmId, true);
  const [alert] = await db.update(alerts).set({ readAt: new Date().toISOString() }).where(eq(alerts.id, alertId)).returning();
  return Response.json({ alert });
}

export async function convertAlertToTask(request: Request, alertId: number) {
  const db = await getDb();
  const [current] = await db.select().from(alerts).where(eq(alerts.id, alertId));
  if (!current) throw new Error("Alerta não encontrado.");
  await requireFarmAccess(request, current.farmId, true);
  if (current.taskId) {
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, current.taskId));
    if (existing) return Response.json({ task: existing, alert: current });
  }
  // O D1 não suporta db.transaction; db.batch é atômico. O alerta recebe o id da tarefa via subconsulta.
  const [[task], [alert]] = await db.batch([
    db.insert(tasks).values({
      farmId: current.farmId,
      title: current.title,
      type: "Alerta",
      lote: "",
      origin: null,
      destination: null,
      dueDate: current.dueDate,
      status: "pending",
      details: current.message,
      sourceAlertId: current.id,
    }).returning(),
    db.update(alerts).set({
      taskId: sql`(select ${tasks.id} from ${tasks} where ${tasks.sourceAlertId} = ${current.id})`,
      readAt: new Date().toISOString(),
    }).where(eq(alerts.id, current.id)).returning(),
  ]);
  return Response.json({ task, alert }, { status: 201 });
}

export async function listRentalOffers(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = params.get("region")?.trim();
  const farmId = params.get("farmId") ? Number(params.get("farmId")) : null;
  const minimumCapacity = params.get("minCapacity") ? Number(params.get("minCapacity")) : null;
  if (farmId !== null && (!Number.isInteger(farmId) || farmId < 1)) throw new Error("Fazenda inválida.");
  if (minimumCapacity !== null && (!Number.isInteger(minimumCapacity) || minimumCapacity < 0)) throw new Error("Capacidade mínima inválida.");
  const filters = [eq(rentalOffers.status, "published")];
  if (farmId !== null) {
    await requireFarmAccess(request, farmId);
    filters.push(eq(rentalOffers.farmId, farmId));
  }
  if (region) filters.push(eq(rentalOffers.region, region));
  if (minimumCapacity !== null) filters.push(sql`(${rentalOffers.capacityNovilho} + ${rentalOffers.capacityMedio} + ${rentalOffers.capacityGrande}) >= ${minimumCapacity}`);
  const db = await getDb();
  return db.select({
    id: rentalOffers.id,
    farmId: rentalOffers.farmId,
    areaId: rentalOffers.areaId,
    region: rentalOffers.region,
    capacityNovilho: rentalOffers.capacityNovilho,
    capacityMedio: rentalOffers.capacityMedio,
    capacityGrande: rentalOffers.capacityGrande,
    monthlyRateNovilho: rentalOffers.monthlyRateNovilho,
    monthlyRateMedio: rentalOffers.monthlyRateMedio,
    monthlyRateGrande: rentalOffers.monthlyRateGrande,
    description: rentalOffers.description,
    status: rentalOffers.status,
    areaName: areas.name,
    areaSize: areas.size,
  }).from(rentalOffers).innerJoin(areas, eq(areas.id, rentalOffers.areaId)).where(and(...filters)).orderBy(asc(rentalOffers.createdAt));
}

export async function createRentalOffer(request: Request) {
  actorFromRequest(request);
  const payload = await readJson(request);
  const farmId = Number(payload.farmId);
  const areaId = Number(payload.areaId);
  await requireFarmAccess(request, farmId, true);
  await farmForId(farmId);
  const db = await getDb();
  const [area] = await db.select().from(areas).where(and(eq(areas.id, areaId), eq(areas.farmId, farmId)));
  if (!area) throw new Error("Área não encontrada.");
  const today = new Date().toISOString().slice(0, 10);
  const occupationsForArea = await db.select().from(occupations).where(and(eq(occupations.areaId, areaId), eq(occupations.farmId, farmId)));
  const hasScheduledOccupation = occupationsForArea.some((occupation) => {
    const end = occupation.endedAt ?? "9999-12-31";
    return end >= today;
  });
  if (hasScheduledOccupation) throw new Error("A área possui ocupação ativa ou agendada e não pode ser publicada.");
  const [existingOffer] = await db.select({ id: rentalOffers.id }).from(rentalOffers).where(and(eq(rentalOffers.areaId, areaId), eq(rentalOffers.status, "published")));
  if (existingOffer) throw new Error("A área já possui uma oferta publicada.");
  const values = parseRentalOffer(payload);
  const [offer] = await db.insert(rentalOffers).values({ ...values, farmId, areaId }).returning();
  await audit(request, farmId, "create", "rental_offer", offer.id);
  return Response.json({ offer: { ...offer, areaName: area.name, areaSize: area.size } }, { status: 201 });
}

export async function updateRentalOffer(request: Request, offerId: number) {
  const payload = await readJson(request);
  const db = await getDb();
  const [current] = await db.select().from(rentalOffers).where(eq(rentalOffers.id, offerId));
  if (!current) throw new Error("Oferta não encontrada.");
  await requireFarmAccess(request, current.farmId, true);
  const values = parseRentalOffer(payload);
  const [offer] = await db.update(rentalOffers).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(rentalOffers.id, offerId)).returning();
  await audit(request, current.farmId, "update", "rental_offer", offerId);
  return Response.json({ offer });
}

export async function closeRentalOffer(request: Request, offerId: number) {
  const db = await getDb();
  const [current] = await db.select().from(rentalOffers).where(eq(rentalOffers.id, offerId));
  if (!current) throw new Error("Oferta não encontrada.");
  await requireFarmAccess(request, current.farmId, true);
  const [offer] = await db.update(rentalOffers).set({ status: "closed", updatedAt: new Date().toISOString() }).where(eq(rentalOffers.id, offerId)).returning();
  await audit(request, current.farmId, "close", "rental_offer", offerId);
  return Response.json({ offer });
}

export async function requestRentalContact(request: Request, offerId: number) {
  const requesterId = actorFromRequest(request);
  const db = await getDb();
  const [offer] = await db.select().from(rentalOffers).where(and(eq(rentalOffers.id, offerId), eq(rentalOffers.status, "published")));
  if (!offer) throw new Error("Oferta não encontrada.");
  await db.insert(rentalContactRequests).values({ offerId, requesterId }).onConflictDoNothing();
  return Response.json({ contact: offer.contact });
}
