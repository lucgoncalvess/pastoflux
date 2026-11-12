import assert from "node:assert/strict";
import test from "node:test";
import { areaWarning, isCapacityExceeded, parseAnimal, parseArea, parseFarm, parseMeasurement, parseRentalOffer, parseTask, recoveryEndDate } from "../lib/domain-validation.js";
import { simulateGrazing } from "../lib/simulator.js";

test("validates persistent farm, area and task payloads", () => {
  assert.deepEqual(parseFarm({ name: "Fazenda Santa Luzia", totalArea: "72" }), { name: "Fazenda Santa Luzia", totalArea: 72 });
  assert.deepEqual(parseArea({ name: "Piquete Norte", size: "24", notes: "Descanso" }), { name: "Piquete Norte", size: 24, maxCapacity: 0, notes: "Descanso" });
  assert.equal(parseTask({ title: "Remanejamento", type: "Pastagem", dueDate: "2026-10-20" }).status, "pending");
  assert.throws(() => parseFarm({ name: "", totalArea: 72 }), /obrigatório/);
  assert.throws(() => parseArea({ name: "Piquete", size: 0 }), /maior que zero/);
  assert.throws(() => parseTask({ title: "Tarefa", type: "Pastagem", dueDate: "20-10-2026" }), /inválida/);
});

test("warns when mapped areas exceed the farm total", () => {
  assert.equal(areaWarning(72, [{ id: 1, size: 24 }, { id: 2, size: 18 }], 20), null);
  assert.match(areaWarning(72, [{ id: 1, size: 24 }, { id: 2, size: 18 }], 31) ?? "", /ultrapassa/);
  assert.equal(areaWarning(72, [{ id: 1, size: 24 }, { id: 2, size: 18 }], 30, 2), null);
});

test("validates Sprint 3 herd, pasture and simulator rules", () => {
  assert.deepEqual(parseAnimal({ identification: "BR-001", category: "Vaca", birthDate: "2024-01-10" }).identification, "BR-001");
  assert.equal(parseMeasurement({ measuredAt: "2026-10-23", availability: 75, source: "manual" }).availability, 75);
  assert.throws(() => parseMeasurement({ measuredAt: "2026-10-23", availability: 101, source: "manual" }), /entre 0 e 100/);
  assert.equal(simulateGrazing({ animals: 48, area: 24, availability: 18 }), 1);
  assert.throws(() => simulateGrazing({ animals: 0, area: 24, availability: 18 }), /válidos/);
});

test("validates Sprint 4 rental offer payloads", () => {
  assert.deepEqual(parseRentalOffer({
    region: "Sul de Minas",
    capacityNovilho: "20",
    capacityMedio: "40",
    capacityGrande: "20",
    monthlyRateNovilho: "55",
    monthlyRateMedio: "75.50",
    monthlyRateGrande: "95",
    contact: "owner@example.com",
    description: "Pasto cercado",
  }), {
    region: "Sul de Minas",
    capacityNovilho: 20,
    capacityMedio: 40,
    capacityGrande: 20,
    monthlyRateNovilho: 55,
    monthlyRateMedio: 75.5,
    monthlyRateGrande: 95,
    contact: "owner@example.com",
    description: "Pasto cercado",
  });

  test("calculates occupation alerts from capacity and recovery dates", () => {
    assert.equal(isCapacityExceeded(81, 80), true);
    assert.equal(isCapacityExceeded(80, 80), false);
    assert.equal(isCapacityExceeded(81, 0), false);
    assert.equal(recoveryEndDate("2026-10-31", 1), "2026-11-01");
    assert.equal(recoveryEndDate("2026-02-28", 2), "2026-03-02");
    assert.equal(recoveryEndDate(null, 10), null);
  });
  assert.throws(() => parseRentalOffer({ region: "Sul", capacityNovilho: 0, capacityMedio: 1, capacityGrande: 1, monthlyRateNovilho: 100, monthlyRateMedio: 100, monthlyRateGrande: 100, contact: "x" }), /Capacidade/);
});

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the PastoFlux application shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /PASTO/);
  assert.match(html, /FLUX/);
  assert.match(html, /Visão geral/);
  assert.match(html, /Dados persistentes/);
  assert.match(html, /Cadastre sua fazenda/);

  // Confirms no starter template remnants exist
  assert.doesNotMatch(html, /react-loading-skeleton/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /Building your site/);
});
