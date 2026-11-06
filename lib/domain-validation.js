// Conjunto de status permitidos para tarefas da agenda de manejo
const taskStatuses = new Set(["pending", "completed"]);

/**
 * Valida se um campo de texto obrigatório foi preenchido.
 * Remove espaços extras nas extremidades e lança erro caso esteja vazio.
 */
function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} é obrigatório.`);
  return value.trim();
}

/**
 * Valida se o valor informado é um número positivo válido (> 0).
 * Garante que medidas de hectares e dimensões sejam grandezas reais.
 */
function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} deve ser maior que zero.`);
  return number;
}

/**
 * Valida se a data está no padrão ISO YYYY-MM-DD e se representa uma data real válida no calendário.
 */
function validDate(value) {
  const date = requiredText(value, "Data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) throw new Error("Data inválida.");
  return date;
}

/**
 * Valida e sanitiza os dados de entrada para criação ou atualização de Fazenda.
 * Exige nome não-vazio e área total positiva.
 */
export function parseFarm(input) {
  return {
    name: requiredText(input.name, "Nome da fazenda"),
    totalArea: positiveNumber(input.totalArea, "Área total"),
  };
}

/**
 * Valida e sanitiza os dados de entrada para criação ou edição de Áreas (piquetes/pastos).
 * Exige nome, tamanho em hectares maior que zero e notas opcionais tratadas.
 */
export function parseArea(input) {
  return {
    name: requiredText(input.name, "Nome da área"),
    size: positiveNumber(input.size, "Tamanho da área"),
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

/**
 * Valida e sanitiza os dados de uma Atividade/Tarefa da Agenda de Manejo.
 * Garante obrigatoriedade de título, categoria, data válida e status consistente ('pending' ou 'completed').
 */
export function parseTask(input) {
  const status = input.status ?? "pending";
  if (!taskStatuses.has(status)) throw new Error("Situação da tarefa inválida.");
  return {
    title: requiredText(input.title, "Título"),
    type: requiredText(input.type, "Categoria"),
    lote: typeof input.lote === "string" ? input.lote.trim() : "",
    origin: typeof input.origin === "string" ? input.origin.trim() : "",
    destination: typeof input.destination === "string" ? input.destination.trim() : "",
    dueDate: validDate(input.dueDate),
    status,
    details: typeof input.details === "string" ? input.details.trim() : "",
  };
}

/**
 * Regra de Negócio da Sprint 2:
 * Calcula a soma das áreas já cadastradas e emite aviso caso a nova área (ou edição)
 * faça com que o total mapeado ultrapasse a área total da fazenda.
 * @param {number} totalArea Área total da propriedade em hectares
 * @param {Array} existingAreas Lista de áreas já existentes no banco
 * @param {number} nextArea Tamanho da área que está sendo adicionada/editada
 * @param {number} [ignoredAreaId] ID da área em edição (para não somar ela mesma duas vezes)
 */
export function areaWarning(totalArea, existingAreas, nextArea, ignoredAreaId) {
  const usedArea = existingAreas
    .filter((area) => area.id !== ignoredAreaId)
    .reduce((total, area) => total + Number(area.size), 0);
  return usedArea + nextArea > Number(totalArea)
    ? "A soma das áreas ultrapassa a área total cadastrada para a fazenda."
    : null;
}

export function parseAnimal(input) {
  return {
    identification: requiredText(input.identification, "Identificação"),
    category: requiredText(input.category, "Categoria"),
    weight: input.weight === undefined || input.weight === null || input.weight === "" ? null : positiveNumber(input.weight, "Peso"),
    birthDate: input.birthDate ? validDate(input.birthDate) : null,
    active: input.active !== false,
  };
}

export function parseLot(input) {
  return { name: requiredText(input.name, "Nome do lote") };
}

export function parseMovement(input) {
  return {
    lotId: positiveNumber(input.lotId, "Lote"),
    origin: typeof input.origin === "string" ? input.origin.trim() : null,
    destination: requiredText(input.destination, "Destino"),
    originAreaId: input.originAreaId ? positiveNumber(input.originAreaId, "Área de origem") : null,
    destinationAreaId: positiveNumber(input.destinationAreaId, "Área de destino"),
    movedAt: validDate(input.movedAt),
    quantity: Math.floor(positiveNumber(input.quantity, "Quantidade")),
    recoveryDays: input.recoveryDays === undefined ? 0 : Math.max(0, Math.floor(Number(input.recoveryDays))),
  };
}

export function parseMeasurement(input) {
  const availability = Number(input.availability);
  if (!Number.isFinite(availability) || availability < 0 || availability > 100) {
    throw new Error("Disponibilidade deve estar entre 0 e 100.");
  }
  return {
    measuredAt: validDate(input.measuredAt),
    availability,
    source: requiredText(input.source, "Origem da medição"),
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

export function parseRentalOffer(input) {
  const positiveInteger = (value, label) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} deve ser maior que zero.`);
    return number;
  };
  return {
    region: requiredText(input.region, "Região"),
    capacityNovilho: positiveInteger(input.capacityNovilho, "Capacidade de novilhos"),
    capacityMedio: positiveInteger(input.capacityMedio, "Capacidade de animais médios"),
    capacityGrande: positiveInteger(input.capacityGrande, "Capacidade de animais grandes"),
    monthlyRateNovilho: positiveNumber(input.monthlyRateNovilho, "Valor mensal por novilho"),
    monthlyRateMedio: positiveNumber(input.monthlyRateMedio, "Valor mensal por animal médio"),
    monthlyRateGrande: positiveNumber(input.monthlyRateGrande, "Valor mensal por animal grande"),
    contact: requiredText(input.contact, "Contato"),
    description: typeof input.description === "string" ? input.description.trim() : "",
  };
}
