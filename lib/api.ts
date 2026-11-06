// Definições de tipos TypeScript compartilhadas entre frontend e backend
export type Farm = { id: number; name: string; totalArea: number };
export type Area = { id: number; farmId: number; name: string; size: number; notes: string };
export type ManagementTask = {
  id: number;
  farmId: number;
  title: string;
  type: string;
  lote: string;
  origin: string | null;
  destination: string | null;
  dueDate: string;
  status: "pending" | "completed";
  details: string;
};
export type Animal = { id: number; farmId: number; identification: string; category: string; weight: number | null; birthDate: string | null; active: boolean };
export type Lot = { id: number; farmId: number; name: string };
export type Movement = { id: number; farmId: number; lotId: number; origin: string | null; destination: string; originAreaId: number | null; destinationAreaId: number; movedAt: string; quantity: number; recoveryDays: number };
export type PastureMeasurement = { id: number; farmId: number; areaId: number; measuredAt: string; availability: number; source: string; notes: string };
export type RentalOffer = {
  id: number; farmId: number; areaId: number; region: string; areaName: string; areaSize: number;
  capacityNovilho: number; capacityMedio: number; capacityGrande: number;
  monthlyRateNovilho: number; monthlyRateMedio: number; monthlyRateGrande: number;
  description: string; status: "published" | "closed";
};

/**
 * Cliente HTTP genérico com tratamento de erros da API.
 * Intercepta mensagens de erro do backend e lança Error tipado.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const activeFarmId = window.localStorage.getItem("pastoflux.activeFarmId");
    if (activeFarmId) headers.set("x-farm-id", activeFarmId);
  }
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir a operação.");
  return body;
}

// Operações de API para Fazendas (Propriedades)
export const farmApi = {
  list: () => request<{ farms: Farm[] }>("/api/farms"),
  create: (payload: Pick<Farm, "name" | "totalArea">) =>
    request<{ farm: Farm }>("/api/farms", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Pick<Farm, "name" | "totalArea">) =>
    request<{ farm: Farm }>(`/api/farms/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

// Operações de API para Áreas (Piquetes)
export const areaApi = {
  list: (farmId: number) => request<{ areas: Area[] }>(`/api/areas?farmId=${farmId}`),
  create: (payload: Omit<Area, "id">) =>
    request<{ area: Area; warning: string | null }>("/api/areas", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Omit<Area, "id">) =>
    request<{ area: Area; warning: string | null }>(`/api/areas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

// Operações de API para Tarefas da Agenda de Manejo
export const taskApi = {
  list: (farmId: number) => request<{ tasks: ManagementTask[] }>(`/api/tasks?farmId=${farmId}`),
  create: (payload: Omit<ManagementTask, "id">) =>
    request<{ task: ManagementTask }>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Omit<ManagementTask, "id">) =>
    request<{ task: ManagementTask }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

export const animalApi = {
  list: (farmId: number) => request<{ animals: Animal[] }>(`/api/animals?farmId=${farmId}`),
  create: (payload: Omit<Animal, "id">) => request<{ animal: Animal }>("/api/animals", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Omit<Animal, "id">) => request<{ animal: Animal }>(`/api/animals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
export const lotApi = {
  list: (farmId: number) => request<{ lots: Lot[] }>(`/api/lots?farmId=${farmId}`),
  create: (payload: { farmId: number; name: string }) => request<{ lot: Lot }>("/api/lots", { method: "POST", body: JSON.stringify(payload) }),
};
export const movementApi = {
  list: (farmId: number) => request<{ movements: Movement[] }>(`/api/movements?farmId=${farmId}`),
  create: (payload: Omit<Movement, "id">) => request<{ movement: Movement }>("/api/movements", { method: "POST", body: JSON.stringify(payload) }),
};
export const occupationApi = {
  list: (farmId: number) => request<{ occupations: { id: number; areaId: number; lotId: number; status: string; startedAt: string; endedAt: string | null }[] }>(`/api/occupations?farmId=${farmId}`),
};
export const measurementApi = {
  list: (areaId: number) => request<{ measurements: PastureMeasurement[] }>(`/api/pasture-measurements?areaId=${areaId}`),
  create: (payload: Omit<PastureMeasurement, "id">) => request<{ measurement: PastureMeasurement }>("/api/pasture-measurements", { method: "POST", body: JSON.stringify(payload) }),
};
export const herdStatsApi = {
  get: (farmId: number, category?: string) => request<{ heads: number; averageWeight: number; categories: { category: string; heads: number }[] }>(`/api/rebanho/stats?farmId=${farmId}${category ? `&category=${encodeURIComponent(category)}` : ""}`),
};
export const rentalApi = {
  list: (region?: string, minCapacity?: number, farmId?: number) => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (minCapacity !== undefined) params.set("minCapacity", String(minCapacity));
    if (farmId !== undefined) params.set("farmId", String(farmId));
    const query = params.toString();
    return request<{ offers: RentalOffer[] }>(`/api/rental-offers${query ? `?${query}` : ""}`);
  },
  create: (payload: {
    farmId: number; areaId: number; region: string;
    capacityNovilho: number; capacityMedio: number; capacityGrande: number;
    monthlyRateNovilho: number; monthlyRateMedio: number; monthlyRateGrande: number;
    contact: string; description: string;
  }) =>
    request<{ offer: RentalOffer & { contact: string } }>("/api/rental-offers", { method: "POST", body: JSON.stringify(payload) }),
  update: (offerId: number, payload: {
    region: string; capacityNovilho: number; capacityMedio: number; capacityGrande: number;
    monthlyRateNovilho: number; monthlyRateMedio: number; monthlyRateGrande: number;
    contact: string; description: string;
  }) =>
    request<{ offer: RentalOffer }>(`/api/rental-offers/${offerId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  requestContact: (offerId: number) =>
    request<{ contact: string }>(`/api/rental-offers/${offerId}/contact`, { method: "POST" }),
  close: (offerId: number) =>
    request<{ offer: RentalOffer }>(`/api/rental-offers/${offerId}`, { method: "DELETE" }),
};
