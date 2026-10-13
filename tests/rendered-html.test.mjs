import assert from "node:assert/strict";
import test from "node:test";
import { areaWarning, parseArea, parseFarm, parseTask } from "../lib/domain-validation.js";

test("validates persistent farm, area and task payloads", () => {
  assert.deepEqual(parseFarm({ name: "Fazenda Santa Luzia", totalArea: "72" }), { name: "Fazenda Santa Luzia", totalArea: 72 });
  assert.deepEqual(parseArea({ name: "Piquete Norte", size: "24", notes: "Descanso" }), { name: "Piquete Norte", size: 24, notes: "Descanso" });
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
