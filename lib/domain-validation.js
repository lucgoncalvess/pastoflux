const taskStatuses = new Set(["pending", "completed"]);

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} é obrigatório.`);
  return value.trim();
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} deve ser maior que zero.`);
  return number;
}

function validDate(value) {
  const date = requiredText(value, "Data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) throw new Error("Data inválida.");
  return date;
}

export function parseFarm(input) { return { name: requiredText(input.name, "Nome da fazenda"), totalArea: positiveNumber(input.totalArea, "Área total") }; }
export function parseArea(input) { return { name: requiredText(input.name, "Nome da área"), size: positiveNumber(input.size, "Tamanho da área"), notes: typeof input.notes === "string" ? input.notes.trim() : "" }; }
export function parseTask(input) {
  const status = input.status ?? "pending";
  if (!taskStatuses.has(status)) throw new Error("Situação da tarefa inválida.");
  return { title: requiredText(input.title, "Título"), type: requiredText(input.type, "Categoria"), lote: typeof input.lote === "string" ? input.lote.trim() : "", origin: typeof input.origin === "string" ? input.origin.trim() : "", destination: typeof input.destination === "string" ? input.destination.trim() : "", dueDate: validDate(input.dueDate), status, details: typeof input.details === "string" ? input.details.trim() : "" };
}
export function areaWarning(totalArea, existingAreas, nextArea, ignoredAreaId) {
  const usedArea = existingAreas.filter((area) => area.id !== ignoredAreaId).reduce((total, area) => total + Number(area.size), 0);
  return usedArea + nextArea > Number(totalArea) ? "A soma das áreas ultrapassa a área total cadastrada para a fazenda." : null;
}
