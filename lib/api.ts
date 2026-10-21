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

/**
 * Cliente HTTP genérico com tratamento de erros da API.
 * Intercepta mensagens de erro do backend e lança Error tipado.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
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

