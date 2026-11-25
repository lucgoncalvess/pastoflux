"use client";

import { useCallback, useEffect, useState } from "react";
import { alertApi, animalApi, areaApi, farmApi, herdStatsApi, lotApi, measurementApi, movementApi, occupationApi, rentalApi, taskApi, type Animal, type Area, type Farm, type FarmAlert, type Lot, type ManagementTask as PersistedTask, type RentalOffer } from "@/lib/api";
import { simulateGrazing } from "@/lib/simulator";

type PersistentView = "visao" | "fazenda" | "rebanho" | "pastagens" | "simulador" | "agenda" | "aluguel";
type DialogName = "farm" | "area" | "task" | null;

const persistentNav: { id: PersistentView; label: string; icon: string }[] = [
  { id: "visao", label: "Visão geral", icon: "⌂" },
  { id: "fazenda", label: "Fazenda", icon: "⌂" },
  { id: "rebanho", label: "Rebanho", icon: "◉" },
  { id: "pastagens", label: "Pastagens", icon: "⌁" },
  { id: "simulador", label: "Simulador", icon: "↗" },
  { id: "agenda", label: "Agenda", icon: "□" },
  { id: "aluguel", label: "Aluguel", icon: "◇" },
];

export default function Home() {
  return <PersistentPastoFlux />;
}

function PersistentPastoFlux() {
  const [view, setView] = useState<PersistentView>("visao");
  const [farm, setFarm] = useState<Farm | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<PersistedTask[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [occupations, setOccupations] = useState<{ id: number; areaId: number; lotId: number; status: string; startedAt: string; endedAt: string | null }[]>([]);
  const [alerts, setAlerts] = useState<FarmAlert[]>([]);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingTask, setEditingTask] = useState<PersistedTask | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const showError = useCallback((value: unknown) => { setError(value instanceof Error ? value.message : "Não foi possível concluir a operação."); }, []);
  const showNotice = useCallback((value: string) => { setNotice(value); window.setTimeout(() => setNotice(""), 3000); }, []);
  function loadFarmData(selected: Farm) {
    void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id), animalApi.list(selected.id), lotApi.list(selected.id), occupationApi.list(selected.id), alertApi.list(selected.id)]).then(([areaResult, taskResult, animalResult, lotResult, occupationResult, alertResult]) => {
      setAreas(areaResult.areas); setTasks(taskResult.tasks); setAnimals(animalResult.animals); setLots(lotResult.lots); setOccupations(occupationResult.occupations); setAlerts(alertResult.alerts);
    }).catch(showError);
  }

  useEffect(() => {
    void farmApi.list().then(({ farms: values }) => {
      setFarms(values);
      const savedId = Number(window.localStorage.getItem("pastoflux.activeFarmId"));
      const selected = values.find((item) => item.id === savedId) ?? values[0];
      if (selected) {
        window.localStorage.setItem("pastoflux.activeFarmId", String(selected.id));
        setFarm(selected);
        void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id), animalApi.list(selected.id), lotApi.list(selected.id), occupationApi.list(selected.id), alertApi.list(selected.id)]).then(([areaResult, taskResult, animalResult, lotResult, occupationResult, alertResult]) => {
          setAreas(areaResult.areas); setTasks(taskResult.tasks); setAnimals(animalResult.animals); setLots(lotResult.lots); setOccupations(occupationResult.occupations); setAlerts(alertResult.alerts);
        }).catch(showError);
      }
    }).catch(showError);
  }, [showError]);

  const mappedArea = areas.reduce((total, area) => total + Number(area.size), 0);
  const pendingTasks = tasks.filter((task) => task.status === "pending");

  async function saveFarm(formData: FormData) {
    setError("");
    try {
      const payload = { name: String(formData.get("name") ?? ""), totalArea: Number(formData.get("totalArea")) };
      const result = farm ? await farmApi.update(farm.id, payload) : await farmApi.create(payload);
      const saved = result.farm;
      setFarm(saved);
      setFarms((values) => values.some((item) => item.id === saved.id) ? values.map((item) => item.id === saved.id ? saved : item) : [...values, saved]);
      window.localStorage.setItem("pastoflux.activeFarmId", String(saved.id));
      setDialog(null);
      loadFarmData(saved);
      showNotice("Fazenda salva com sucesso.");
    } catch (cause) { showError(cause); }
  }

  async function saveArea(formData: FormData) {
    if (!farm) return;
    setError("");
    try {
      const payload = { farmId: farm.id, name: String(formData.get("name") ?? ""), size: Number(formData.get("size")), maxCapacity: Number(formData.get("maxCapacity")), notes: String(formData.get("notes") ?? "") };
      const result = editingArea ? await areaApi.update(editingArea.id, payload) : await areaApi.create(payload);
      setAreas((values) => editingArea ? values.map((item) => item.id === result.area.id ? result.area : item) : [...values, result.area]);
      setDialog(null); setEditingArea(null); showNotice(result.warning ?? "Área salva com sucesso.");
    } catch (cause) { showError(cause); }
  }

  async function saveTask(formData: FormData) {
    if (!farm) return;
    setError("");
    try {
      const payload = { farmId: farm.id, title: String(formData.get("title") ?? ""), type: String(formData.get("type") ?? "Pastagem"), lote: String(formData.get("lote") ?? ""), origin: String(formData.get("origin") ?? ""), destination: String(formData.get("destination") ?? ""), dueDate: String(formData.get("dueDate") ?? ""), status: editingTask?.status ?? "pending" as const, details: String(formData.get("details") ?? "") };
      const result = editingTask ? await taskApi.update(editingTask.id, payload) : await taskApi.create(payload);
      setTasks((values) => editingTask ? values.map((item) => item.id === result.task.id ? result.task : item) : [...values, result.task]);
      setDialog(null); setEditingTask(null); showNotice("Atividade salva com sucesso.");
    } catch (cause) { showError(cause); }
  }

  async function toggleTask(task: PersistedTask) {
    try {
      const { task: updated } = await taskApi.update(task.id, { ...task, status: task.status === "pending" ? "completed" : "pending" });
      setTasks((values) => values.map((item) => item.id === updated.id ? updated : item));
      showNotice(updated.status === "completed" ? "Atividade concluída." : "Atividade reaberta.");
    } catch (cause) { showError(cause); }
  }

  function openArea(area?: Area) { setEditingArea(area ?? null); setError(""); setDialog("area"); }
  function openTask(task?: PersistedTask) { setEditingTask(task ?? null); setError(""); setDialog("task"); }
  const needFarm = !farm;
  function selectFarm(value: string) {
    const selected = farms.find((item) => item.id === Number(value));
    if (!selected) return;
    window.localStorage.setItem("pastoflux.activeFarmId", String(selected.id));
    setFarm(selected);
    loadFarmData(selected);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("visao")} aria-label="Ir para visão geral"><span className="brand-mark"><i /><i /><i /></span><span>PASTO<span>FLUX</span></span></button>
        <div className="farm-switcher"><span className="farm-avatar">{farm?.name.slice(0, 2).toUpperCase() ?? "PF"}</span><span><small>PROPRIEDADE ATIVA</small><select value={farm?.id ?? ""} onChange={(event) => selectFarm(event.target.value)} aria-label="Selecionar fazenda">{farms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{!farms.length && <option value="">Cadastre sua fazenda</option>}</select></span><button type="button" onClick={() => { setError(""); setDialog("farm"); }} aria-label="Cadastrar ou editar fazenda">Editar</button></div>
        <nav aria-label="Navegação principal"><small>GESTÃO</small>{persistentNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-card"><span className="signal"><i /><i /><i /></span><div><strong>Dados persistentes</strong><small>{farm ? "Sincronizados no D1" : "Aguardando cadastro"}</small></div></div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">PASTO<span>FLUX</span></div>
          <div className="breadcrumb">{farm?.name ?? "Nova propriedade"} <span>/</span> {persistentNav.find((item) => item.id === view)?.label}</div>
          <div className="top-actions"><button className="tour-button" onClick={() => setView("agenda")}>Ver agenda</button></div>
        </header>
        <div className="mobile-nav">{persistentNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>
        <div className="content">
          {error && <div className="form-error" role="alert">{error}</div>}
          {view === "visao" && <OverviewPersisted farm={farm} mappedArea={mappedArea} areas={areas.length} pending={pendingTasks.length} alerts={alerts} onAlertTask={async (alert) => { try { const result = await alertApi.convertToTask(alert.id); setTasks((values) => values.some((item) => item.id === result.task.id) ? values : [...values, result.task]); setAlerts((values) => values.map((item) => item.id === alert.id ? result.alert : item)); showNotice("Alerta convertido em tarefa."); } catch (cause) { showError(cause); } }} openFarm={() => setDialog("farm")} openArea={() => openArea()} openTask={() => openTask()} />}
          {view === "fazenda" && <FarmView farm={farm} mappedArea={mappedArea} areaCount={areas.length} openFarm={() => setDialog("farm")} />}
          {view === "pastagens" && <AreasView farm={farm} areas={areas} mappedArea={mappedArea} openArea={openArea} occupations={occupations} />}
          {view === "agenda" && <AgendaPersisted farm={farm} tasks={tasks} openTask={openTask} toggleTask={toggleTask} />}
          {view === "simulador" && <SimulatorPersisted onSchedule={() => openTask()} />}
          {view === "rebanho" && <HerdView farm={farm} areas={areas} animals={animals} lots={lots} onAnimals={(created) => setAnimals((values) => [...values, ...created])} onLot={(lot) => setLots((values) => [...values, lot])} onMovement={() => farm && loadFarmData(farm)} />}
          {view === "aluguel" && <RentalView farm={farm} areas={areas} showNotice={showNotice} showError={showError} />}
        </div>
      </section>
      {dialog === "farm" && <FarmDialog farm={farm} onClose={() => setDialog(null)} onSave={saveFarm} error={error} />}
      {dialog === "area" && farm && <AreaDialog farm={farm} area={editingArea} onClose={() => { setDialog(null); setEditingArea(null); }} onSave={saveArea} error={error} />}
      {dialog === "task" && farm && <TaskDialog task={editingTask} onClose={() => { setDialog(null); setEditingTask(null); }} onSave={saveTask} error={error} />}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
      {needFarm && <div className="empty-state"><strong>Comece cadastrando a sua fazenda.</strong><button className="primary" onClick={() => setDialog("farm")}>Cadastrar fazenda</button></div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

function OverviewPersisted({ farm, mappedArea, areas, pending, alerts, onAlertTask, openFarm, openArea, openTask }: { farm: Farm | null; mappedArea: number; areas: number; pending: number; alerts: FarmAlert[]; onAlertTask: (alert: FarmAlert) => void; openFarm: () => void; openArea: () => void; openTask: () => void }) {
  return (
    <>
      <PageHeading eyebrow="VISÃO GERAL" title={farm ? `Olá, ${farm.name}.` : "Bem-vindo ao PastoFlux."} text="Acompanhe os dados persistentes da sua propriedade." action={<button className="primary big" onClick={farm ? openTask : openFarm}>＋ {farm ? "Nova atividade" : "Cadastrar fazenda"}</button>} />
      <section className="stat-grid">
        <PersistentStat label="ÁREA TOTAL" value={farm ? String(farm.totalArea) : "—"} unit="hectares" icon="⌁" />
        <PersistentStat label="ÁREA MAPEADA" value={String(mappedArea)} unit="hectares" icon="▱" />
        <PersistentStat label="ÁREAS CADASTRADAS" value={String(areas)} unit="pastos" icon="⌂" />
        <PersistentStat label="TAREFAS PENDENTES" value={String(pending)} unit="atividades" warning icon="!" />
      </section>
      <section className="critical-card">
        <div className="critical-icon">!</div>
        <div className="critical-copy">
          <small>PRÓXIMO PASSO</small>
          <h2>{farm ? "Mantenha áreas e agenda atualizadas" : "Cadastre a sua fazenda para iniciar"}</h2>
          <p>{farm ? "Cadastre os piquetes da propriedade e transforme decisões de manejo em tarefas persistentes." : "Nome e área total são obrigatórios. Depois, inclua as áreas reais da propriedade."}</p>
        </div>
        <div className="critical-actions">
          <button className="primary" onClick={farm ? openArea : openFarm}>{farm ? "Cadastrar área" : "Cadastrar fazenda"}</button>
          <button onClick={openTask} disabled={!farm}>Criar atividade</button>
        </div>
      </section>
      {farm && <section className="panel">
        <div className="panel-heading"><div><h2>Alertas de manejo</h2><p>Capacidade, ocupação e recuperação das áreas da fazenda ativa.</p></div></div>
        {alerts.length ? (
          <div className="alert-list">
            {alerts.slice(0, 5).map((alert) => (
              <article className="alert-item" key={alert.id}>
                <div className={`alert-indicator ${alert.type === "capacity_exceeded" ? "warn" : "info"}`}>
                  {alert.type === "capacity_exceeded" ? "!" : "◉"}
                </div>
                <div className="alert-copy">
                  <div className="alert-tags">
                    <span className={`status ${alert.type === "capacity_exceeded" ? "warning" : "good"}`}>
                      {alert.type === "capacity_exceeded" ? "Capacidade" : alert.type === "occupation_ended" ? "Ocupação" : "Recuperação"}
                    </span>
                    <span className="countdown">Data: {alert.dueDate}</span>
                  </div>
                  <h2>{alert.title}</h2>
                  <p>{alert.message}</p>
                </div>
                <div className="task-actions">
                  {alert.taskId ? <span className="status">Na agenda</span> : <button className="primary" onClick={() => onAlertTask(alert)}>Criar tarefa</button>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="agenda-empty"><strong>Nenhum alerta registrado</strong><p>Os alertas serão criados automaticamente a partir das ocupações.</p></div>
        )}
      </section>}
    </>
  );
}

function FarmView({ farm, mappedArea, areaCount, openFarm }: { farm: Farm | null; mappedArea: number; areaCount: number; openFarm: () => void }) {
  return (
    <>
      <PageHeading eyebrow="DADOS DA PROPRIEDADE" title="Fazenda" text="Mantenha os dados básicos e a área total da propriedade." action={<button className="primary big" onClick={openFarm}>{farm ? "Editar fazenda" : "Cadastrar fazenda"}</button>} />
      {farm ? (
        <section className="panel">
          <div className="panel-head"><div><small>CADASTRO PERSISTENTE</small><h2>{farm.name}</h2></div></div>
          <div className="summary-strip">
            <span><small>ÁREA TOTAL</small><strong>{farm.totalArea} ha</strong></span>
            <span><small>ÁREA MAPEADA</small><strong>{mappedArea} ha</strong></span>
            <span><small>ÁREAS</small><strong>{areaCount}</strong></span>
          </div>
        </section>
      ) : (
        <div className="agenda-empty">
          <strong>Nenhuma fazenda cadastrada</strong>
          <p>Cadastre os dados da sua propriedade para ativar Áreas e Agenda.</p>
        </div>
      )}
    </>
  );
}

function AreasView({ farm, areas, mappedArea, openArea, occupations }: { farm: Farm | null; areas: Area[]; mappedArea: number; openArea: (area?: Area) => void; occupations: { areaId: number; lotId: number; status: string }[] }) {
  return (
    <>
      <PageHeading eyebrow="GESTÃO DE PASTAGENS" title="Áreas e pastos" text="Cada área é vinculada à fazenda ativa e permanece disponível após recarregar." action={<button className="primary big" disabled={!farm} onClick={() => openArea()}>＋ Nova área</button>} />
      {farm ? (
        <>
          <section className="summary-strip">
            <span><small>ÁREA TOTAL</small><strong>{farm.totalArea} ha</strong></span>
            <span><small>ÁREA MAPEADA</small><strong>{mappedArea} ha</strong></span>
            <span><small>DISPONÍVEL</small><strong>{Math.max(0, farm.totalArea - mappedArea)} ha</strong></span>
          </section>
          <section className="pasture-grid">
            {areas.length ? areas.map((area) => {
              const occStatus = occupations.find((item) => item.areaId === area.id)?.status ?? "DISPONÍVEL";
              const isOccupied = occStatus.toUpperCase().includes("OCUPAD");
              const isRecovery = occStatus.toUpperCase().includes("RECUPERA");
              const statusClass = isOccupied ? "active" : isRecovery ? "warning" : "good";
              const percentFarm = farm.totalArea > 0 ? Math.round((area.size / farm.totalArea) * 100) : 0;
              return (
                <article className="pasture-card" key={area.id}>
                  <div className="pasture-top">
                    <span className={`status ${statusClass}`}>{occStatus}</span>
                    <button onClick={() => openArea(area)} className="pasture-menu-btn" aria-label={`Editar ${area.name}`}>•••</button>
                  </div>
                  <h3 className="pasture-name">{area.name}</h3>
                  <div className="pasture-metrics-row">
                    <div className="pasture-metric">
                      <small>TAMANHO</small>
                      <strong>{area.size} ha</strong>
                    </div>
                    <div className="pasture-metric">
                      <small>CAPACIDADE MÁXIMA</small>
                      <strong>{area.maxCapacity} cab</strong>
                    </div>
                  </div>
                  <div className="level-label">
                    <span>Participação na fazenda</span>
                    <b>{percentFarm}%</b>
                  </div>
                  <div className="progress">
                    <i className="good" style={{ width: `${Math.min(100, percentFarm)}%` }} />
                  </div>
                  <div className="pasture-notes-box">
                    <small>{area.notes ? `Observação: ${area.notes}` : "Sem observações cadastradas"}</small>
                  </div>
                  <div className="pasture-measurement-divider" />
                  <MeasurementForm farmId={farm.id} areaId={area.id} />
                </article>
              );
            }) : (
              <div className="agenda-empty">
                <strong>Nenhuma área cadastrada</strong>
                <p>Inclua o primeiro piquete ou pasto da propriedade.</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="agenda-empty"><strong>Cadastre a fazenda primeiro</strong></div>
      )}
    </>
  );
}

function MeasurementForm({ farmId, areaId }: { farmId: number; areaId: number }) {
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");
  const [lastRegistered, setLastRegistered] = useState<number | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const val = Number(availability);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new Error("Informe um valor entre 0 e 100%.");
      }
      await measurementApi.create({ farmId, areaId, measuredAt: new Date().toISOString().slice(0, 10), availability: val, source: "manual", notes: "" });
      setLastRegistered(val);
      setAvailability("");
      setMessage("Medição registrada.");
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar.");
    }
  }

  function setQuickValue(val: number) {
    setAvailability(String(val));
  }

  return (
    <form onSubmit={submit} className="measurement-box">
      <div className="measurement-header">
        <small className="measurement-title">DISPONIBILIDADE DO PASTO</small>
        {lastRegistered !== null && (
          <span className="measurement-recent-badge">Última: {lastRegistered}%</span>
        )}
      </div>

      <div className="measurement-input-row">
        <div className="measurement-field">
          <input
            type="number"
            min="0"
            max="100"
            required
            placeholder="0 a 100"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
            aria-label="Disponibilidade em porcentagem"
          />
          <span className="unit-symbol">%</span>
        </div>
        <button type="submit" className="measurement-btn">
          Registrar
        </button>
      </div>

      <div className="measurement-quick-pills">
        <span className="quick-label">Atalhos:</span>
        {[25, 50, 75, 100].map((pct) => (
          <button
            type="button"
            key={pct}
            className={`quick-pill ${availability === String(pct) ? "active" : ""}`}
            onClick={() => setQuickValue(pct)}
          >
            {pct}%
          </button>
        ))}
      </div>

      {message && (
        <div className={`measurement-status ${message.includes("registrada") ? "success" : "error"}`} role="status">
          {message.includes("registrada") ? <span>✓ Medição registrada com sucesso</span> : <span>{message}</span>}
        </div>
      )}
    </form>
  );
}

function HerdView({ farm, areas, animals, lots, onAnimals, onLot, onMovement }: { farm: Farm | null; areas: Area[]; animals: Animal[]; lots: Lot[]; onAnimals: (animals: Animal[]) => void; onLot: (lot: Lot) => void; onMovement: () => void }) {
  const [creationMode, setCreationMode] = useState<"single" | "bulk">("single");
  const [identification, setIdentification] = useState("");
  const [category, setCategory] = useState("Gado");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [weight, setWeight] = useState("");
  const [areaId, setAreaId] = useState("");

  const [bulkPrefix, setBulkPrefix] = useState("GADO");
  const [bulkQuantity, setBulkQuantity] = useState("5");
  const [bulkCategory, setBulkCategory] = useState("Gado");
  const [bulkSex, setBulkSex] = useState<"male" | "female">("male");
  const [bulkWeight, setBulkWeight] = useState("");
  const [bulkAreaId, setBulkAreaId] = useState("");

  const [lotName, setLotName] = useState("");
  const [lotId, setLotId] = useState("");
  const [originAreaId, setOriginAreaId] = useState("");
  const [destinationAreaId, setDestinationAreaId] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<{ heads: number; averageWeight: number; categories: { category: string; heads: number }[] } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (farm) void herdStatsApi.get(farm.id, categoryFilter || undefined).then(setStats).catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível carregar indicadores."));
  }, [farm, categoryFilter]);

  if (!farm) return <div className="agenda-empty"><strong>Cadastre a fazenda primeiro</strong></div>;
  const activeFarm = farm;

  async function addAnimal(event: React.FormEvent) {
    event.preventDefault();
    try {
      const { animal } = await animalApi.create({
        farmId: activeFarm.id,
        identification,
        category,
        sex,
        weight: weight ? Number(weight) : null,
        areaId: areaId ? Number(areaId) : null,
        birthDate: null,
        active: true,
      });
      onAnimals([animal]);
      setIdentification("");
      setWeight("");
      setMessage("Animal cadastrado com sucesso.");
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar.");
    }
  }

  async function addAnimalsInBulk(event: React.FormEvent) {
    event.preventDefault();
    try {
      const quantity = Number(bulkQuantity);
      const prefix = bulkPrefix.trim();
      const animalsToCreate = Array.from({ length: quantity }, (_, index) => ({
        identification: `${prefix}-${String(index + 1).padStart(3, "0")}`,
        category: bulkCategory,
        sex: bulkSex,
        weight: bulkWeight ? Number(bulkWeight) : null,
        areaId: bulkAreaId ? Number(bulkAreaId) : null,
        birthDate: null,
        active: true,
      }));
      const result = await animalApi.createMany({ farmId: activeFarm.id, animals: animalsToCreate });
      onAnimals(result.animals);
      setMessage(`${result.animals.length} animais cadastrados com sucesso.`);
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar os animais.");
    }
  }

  async function addLot(event: React.FormEvent) {
    event.preventDefault();
    try {
      const { lot } = await lotApi.create({ farmId: activeFarm.id, name: lotName });
      onLot(lot);
      setLotName("");
      setMessage("Lote cadastrado com sucesso.");
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar.");
    }
  }

  async function moveLot(event: React.FormEvent) {
    event.preventDefault();
    try {
      await movementApi.create({
        farmId: activeFarm.id,
        lotId: Number(lotId),
        origin: areas.find((item) => item.id === Number(originAreaId))?.name ?? null,
        destination: areas.find((item) => item.id === Number(destinationAreaId))?.name ?? "",
        originAreaId: originAreaId ? Number(originAreaId) : null,
        destinationAreaId: Number(destinationAreaId),
        movedAt: new Date().toISOString().slice(0, 10),
        quantity: animals.length,
        recoveryDays: 0,
      });
      setMessage("Movimentação registrada com sucesso.");
      onMovement();
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível movimentar o lote.");
    }
  }

  const filteredAnimals = categoryFilter
    ? animals.filter((animal) => animal.category === categoryFilter)
    : animals;

  const categories = Array.from(new Set(animals.map((animal) => animal.category)));

  return (
    <>
      <PageHeading
        eyebrow="CONTROLE DO REBANHO"
        title="Animais e lotes"
        text="Cadastre o rebanho persistente, acompanhe pesos, aloque piquetes e organize os animais por lote."
      />

      <div className="summary-strip">
        <span>
          <small>ANIMAIS ATIVOS</small>
          <strong>{stats?.heads ?? animals.filter((animal) => animal.active).length}</strong>
        </span>
        <span>
          <small>PESO MÉDIO</small>
          <strong>{Number(stats?.averageWeight ?? 0).toFixed(1)} kg</strong>
        </span>
        <span>
          <small>LOTES CADASTRADOS</small>
          <strong>{lots.length}</strong>
        </span>
      </div>

      <section className="panel herd-panel">
        <div className="herd-section-heading">
          <div>
            <small>CADASTRO DE REBANHO</small>
            <h2>Adicionar animais</h2>
          </div>
          <div className="herd-mode-selector">
            <button
              type="button"
              className={creationMode === "single" ? "mode-btn active" : "mode-btn"}
              onClick={() => setCreationMode("single")}
            >
              1 unidade (Individual)
            </button>
            <button
              type="button"
              className={creationMode === "bulk" ? "mode-btn active" : "mode-btn"}
              onClick={() => setCreationMode("bulk")}
            >
              Vários animais (Em lote)
            </button>
          </div>
        </div>

        {creationMode === "single" ? (
          <form onSubmit={addAnimal} className="form-grid herd-form">
            <label>
              Identificação / Brinco
              <input required value={identification} onChange={(event) => setIdentification(event.target.value)} placeholder="Ex.: BR-104" />
            </label>
            <label>
              Categoria
              <input required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Vaca, Bezerro, Touro" />
            </label>
            <label>
              Sexo
              <select required value={sex} onChange={(event) => setSex(event.target.value as "male" | "female")}>
                <option value="male">Macho</option>
                <option value="female">Fêmea</option>
              </select>
            </label>
            <label>
              Peso (kg)
              <input type="number" min="1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Ex.: 340.5" />
            </label>
            <label className="wide">
              Área / Piquete atual
              <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                <option value="">Selecione o piquete (opcional)</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name} · {area.size} ha</option>
                ))}
              </select>
            </label>
            <div className="form-actions wide">
              <button className="primary herd-btn" type="submit">Cadastrar animal</button>
            </div>
          </form>
        ) : (
          <form onSubmit={addAnimalsInBulk} className="form-grid herd-form herd-form--bulk">
            <div className="herd-form-title">
              <small>CADASTRO EM MASSA</small>
              <strong>Vários animais com pesos e características semelhantes</strong>
            </div>
            <label>
              Prefixo das identificações
              <input required value={bulkPrefix} onChange={(event) => setBulkPrefix(event.target.value)} placeholder="Ex.: LOTE-A" />
            </label>
            <label>
              Quantidade de animais
              <input required type="number" min="1" max="500" step="1" value={bulkQuantity} onChange={(event) => setBulkQuantity(event.target.value)} />
            </label>
            <label>
              Categoria
              <input required value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} placeholder="Ex.: Garrote, Novilha" />
            </label>
            <label>
              Sexo
              <select required value={bulkSex} onChange={(event) => setBulkSex(event.target.value as "male" | "female")}>
                <option value="male">Macho</option>
                <option value="female">Fêmea</option>
              </select>
            </label>
            <label>
              Peso médio estimado (kg)
              <input type="number" min="0.01" step="0.01" value={bulkWeight} onChange={(event) => setBulkWeight(event.target.value)} placeholder="Opcional" />
            </label>
            <label>
              Área / Piquete de destino
              <select value={bulkAreaId} onChange={(event) => setBulkAreaId(event.target.value)}>
                <option value="">Selecione o piquete (opcional)</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name} · {area.size} ha</option>
                ))}
              </select>
            </label>
            <div className="form-actions wide">
              <button className="primary herd-btn" type="submit">Cadastrar animais</button>
            </div>
          </form>
        )}

        {message && <div className="herd-feedback-msg" role="status">{message}</div>}
      </section>

      <section className="panel herd-panel">
        <div className="herd-section-heading">
          <div>
            <small>MANEJO DE LOTES</small>
            <h2>Lotes e movimentações</h2>
          </div>
        </div>
        <div className="herd-lots-row">
          <form onSubmit={addLot} className="herd-lot-card">
            <h3>Criar novo lote</h3>
            <p>Agrupe animais para facilitar rotações e controle de pastagem.</p>
            <label>
              Nome do lote
              <input required value={lotName} onChange={(event) => setLotName(event.target.value)} placeholder="Ex.: Lote Recria 2026" />
            </label>
            <button className="primary herd-btn" type="submit">Cadastrar lote</button>
          </form>

          <form onSubmit={moveLot} className="herd-lot-card">
            <h3>Movimentar lote entre áreas</h3>
            <p>Transfira o lote para outro piquete e atualize a ocupação.</p>
            <div className="move-fields">
              <label>
                Lote
                <select required value={lotId} onChange={(event) => setLotId(event.target.value)}>
                  <option value="">Selecione</option>
                  {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
                </select>
              </label>
              <label>
                Origem
                <select value={originAreaId} onChange={(event) => setOriginAreaId(event.target.value)}>
                  <option value="">Sem origem</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </label>
              <label>
                Destino
                <select required value={destinationAreaId} onChange={(event) => setDestinationAreaId(event.target.value)}>
                  <option value="">Selecione</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </label>
            </div>
            <button className="primary herd-btn" type="submit">Movimentar lote</button>
          </form>
        </div>
      </section>

      <section className="panel herd-panel">
        <div className="category-filter-section">
          <div className="filter-header">
            <div>
              <small>REBANHO ATIVO</small>
              <h2>Animais cadastrados ({filteredAnimals.length})</h2>
            </div>
          </div>
          {categories.length > 0 && (
            <div className="filter-pills-bar">
              <span className="filter-title"><small>FILTRAR CATEGORIA:</small></span>
              <div className="filter-pills">
                <button
                  type="button"
                  className={categoryFilter === "" ? "filter-pill active" : "filter-pill"}
                  onClick={() => setCategoryFilter("")}
                >
                  Todas ({animals.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={categoryFilter === cat ? "filter-pill active" : "filter-pill"}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat} ({animals.filter((a) => a.category === cat).length})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {filteredAnimals.length ? (
          <div className="animal-grid">
            {filteredAnimals.map((animal) => {
              const areaName = areas.find((a) => a.id === animal.areaId)?.name;
              return (
                <article className="animal-card" key={animal.id}>
                  <div className="animal-card-header">
                    <span className="animal-id-badge">{animal.identification}</span>
                    <span className={`status ${animal.sex === "male" ? "active" : "good"}`}>
                      {animal.sex === "female" ? "Fêmea" : animal.sex === "male" ? "Macho" : "Não informado"}
                    </span>
                  </div>
                  <div className="animal-details">
                    <div className="animal-detail-item">
                      <small>CATEGORIA</small>
                      <strong>{animal.category}</strong>
                    </div>
                    <div className="animal-detail-item">
                      <small>PESO</small>
                      <strong>{animal.weight ? `${animal.weight} kg` : "—"}</strong>
                    </div>
                  </div>
                  <div className="animal-location">
                    <small>PIQUETE / ÁREA</small>
                    <span className="location-tag">
                      {areaName ? `▱ ${areaName}` : "Sem área vinculada"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="agenda-empty">
            <strong>Nenhum animal encontrado</strong>
            <p>{categoryFilter ? "Não há animais cadastrados na categoria selecionada." : "Cadastre o primeiro animal acima."}</p>
          </div>
        )}
      </section>
    </>
  );
}

function AgendaPersisted({ farm, tasks, openTask, toggleTask }: { farm: Farm | null; tasks: PersistedTask[]; openTask: (task?: PersistedTask) => void; toggleTask: (task: PersistedTask) => void }) {
  const pending = tasks.filter((task) => task.status === "pending").length;
  const completed = tasks.length - pending;
  const ordered = [...tasks].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || a.dueDate.localeCompare(b.dueDate));

  return (
    <>
      <PageHeading eyebrow="PLANEJAMENTO DA FAZENDA" title="Agenda de manejo" text="Crie, edite, conclua e reabra atividades no banco de dados." action={<button className="primary big" disabled={!farm} onClick={() => openTask()}>＋ Nova atividade</button>} />
      {farm ? (
        <>
          <section className="agenda-summary">
            <span><small>PENDENTES</small><strong>{pending}</strong></span>
            <span><small>CONCLUÍDAS</small><strong>{completed}</strong></span>
            <span><small>PRÓXIMA ATIVIDADE</small><strong>{ordered[0] ? shortDate(ordered[0].dueDate) : "—"}</strong></span>
          </section>
          <section className="agenda-list">
            {ordered.length ? ordered.map((task) => (
              <article className={`agenda-item ${task.status}`} key={task.id}>
                <div className="agenda-date"><strong>{task.dueDate.slice(8, 10)}</strong><span>{monthName(task.dueDate)}</span></div>
                <div className="agenda-copy">
                  <div>
                    <span className="status good">{task.type}</span>
                    <span className="countdown">{task.status === "completed" ? "Concluída" : shortDate(task.dueDate)}</span>
                  </div>
                  <h2>{task.title}</h2>
                  <p>{task.details || [task.lote, task.origin, task.destination].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="task-actions">
                  <button className="task-edit" onClick={() => openTask(task)}>Editar</button>
                  <button className={task.status === "completed" ? "task-reopen" : "task-complete"} onClick={() => toggleTask(task)}>{task.status === "completed" ? "Reabrir" : "Concluir"}</button>
                </div>
              </article>
            )) : (
              <div className="agenda-empty">
                <strong>Sua agenda está livre</strong>
                <p>Crie uma atividade ou use o simulador para planejar um remanejamento.</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="agenda-empty"><strong>Cadastre a fazenda primeiro</strong></div>
      )}
    </>
  );
}

function SimulatorPersisted({ onSchedule }: { onSchedule: () => void }) {
  const [animals, setAnimals] = useState(48);
  const [area, setArea] = useState(24);
  const [availability, setAvailability] = useState(18);
  const days = simulateGrazing({ animals, area, availability });

  return (
    <>
      <PageHeading eyebrow="SIMULADOR DE PASTAGENS" title="Antecipe o próximo remanejamento" text="A estimativa é demonstrativa e pode ser registrada na Agenda." />
      <section className="sim-layout">
        <div className="sim-form">
          <label>Quantidade de animais<input type="number" min="1" value={animals} onChange={(event) => setAnimals(Number(event.target.value))} /></label>
          <label>Área disponível (ha)<input type="number" min="1" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label>
          <label>Disponibilidade atual<input type="range" min="5" max="100" value={availability} onChange={(event) => setAvailability(Number(event.target.value))} /><b>{availability}%</b></label>
        </div>
        <div className="sim-result">
          <div className="result-head"><span>RESULTADO ATUALIZADO</span><i>● ao vivo</i></div>
          <div className="result-number"><strong>{days}</strong><span>dias</span></div>
          <h2>até atingir o limite estimado</h2>
          <p>Com {animals} animais em {area} hectares e {availability}% de disponibilidade.</p>
          <button className="primary big full" onClick={onSchedule}>Agendar remanejamento</button>
        </div>
      </section>
      <p className="disclaimer">Estimativa demonstrativa. A decisão final deve considerar avaliação de campo e orientação técnica.</p>
    </>
  );
}

function RentalView({ farm, areas, showNotice, showError }: { farm: Farm | null; areas: Area[]; showNotice: (message: string) => void; showError: (error: unknown) => void }) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [ownerOffers, setOwnerOffers] = useState<RentalOffer[]>([]);
  const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
  const [region, setRegion] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [areaId, setAreaId] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    region: "", capacityNovilho: "10", capacityMedio: "10", capacityGrande: "5",
    monthlyRateNovilho: "", monthlyRateMedio: "", monthlyRateGrande: "", contact: "", description: "",
  });

  const loadOffers = useCallback(async () => {
    try {
      const result = await rentalApi.list(region || undefined, minCapacity ? Number(minCapacity) : undefined);
      setOffers(result.offers);
    } catch (error) { showError(error); }
  }, [region, minCapacity, showError]);
  const loadOwnerOffers = useCallback(async () => {
    if (!farm) {
      setOwnerOffers([]);
      return;
    }
    try {
      const result = await rentalApi.list(undefined, undefined, farm.id);
      setOwnerOffers(result.offers);
    } catch (error) { showError(error); }
  }, [farm, showError]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOffers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOffers]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOwnerOffers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOwnerOffers]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!farm) return;
    try {
      const payload = {
        capacityNovilho: Number(form.capacityNovilho), capacityMedio: Number(form.capacityMedio), capacityGrande: Number(form.capacityGrande),
        monthlyRateNovilho: Number(form.monthlyRateNovilho), monthlyRateMedio: Number(form.monthlyRateMedio), monthlyRateGrande: Number(form.monthlyRateGrande),
      };
      if (editingOfferId) {
        await rentalApi.update(editingOfferId, { ...payload, region: form.region, contact: form.contact, description: form.description });
        setMessage("Oferta atualizada.");
        showNotice("Oferta de aluguel atualizada.");
      } else {
        await rentalApi.create({ farmId: farm.id, areaId: Number(areaId), ...payload, region: form.region, contact: form.contact, description: form.description });
        setMessage("Oferta publicada.");
        showNotice("Oferta de aluguel publicada.");
      }
      setEditingOfferId(null);
      setForm((value) => ({ ...value, contact: "", description: "" }));
      await Promise.all([loadOffers(), loadOwnerOffers()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível publicar."); }
  }

  async function requestContact(offerId: number) {
    try {
      const result = await rentalApi.requestContact(offerId);
      setMessage(`Contato liberado: ${result.contact}`);
    } catch (error) { showError(error); }
  }

  async function closeOffer(offerId: number) {
    try {
      await rentalApi.close(offerId);
      showNotice("Oferta encerrada.");
      await Promise.all([loadOffers(), loadOwnerOffers()]);
    } catch (error) { showError(error); }
  }

  function editOffer(offer: RentalOffer) {
    setEditingOfferId(offer.id);
    setAreaId(String(offer.areaId));
    setForm({
      region: offer.region,
      capacityNovilho: String(offer.capacityNovilho),
      capacityMedio: String(offer.capacityMedio),
      capacityGrande: String(offer.capacityGrande),
      monthlyRateNovilho: String(offer.monthlyRateNovilho),
      monthlyRateMedio: String(offer.monthlyRateMedio),
      monthlyRateGrande: String(offer.monthlyRateGrande),
      contact: "",
      description: offer.description,
    });
    setMessage("Informe novamente o contato para salvar a oferta.");
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));
  return (
    <>
      <PageHeading eyebrow="REDE DE PASTAGENS" title="Aluguel por cabeça de gado" text="O proprietário define a lotação e o valor mensal por cabeça conforme a faixa de peso." />
      {farm && (
        <section className="panel rental-section">
          <div className="panel-heading">
            <div>
              <small>ANÚNCIO DE PASTO</small>
              <h2>{editingOfferId ? "Editar oferta de aluguel" : "Publicar área para aluguel"}</h2>
            </div>
          </div>
          <form onSubmit={publish} className="form-grid rental-form">
            <label>Área<select required value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Selecione uma área livre</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.size} ha</option>)}</select></label>
            <label>Região<input required value={form.region} onChange={update("region")} placeholder="Ex.: Sul de Minas" /></label>
            <label>Novilhos (&lt;150 kg) — cabeças<input required type="number" min="1" value={form.capacityNovilho} onChange={update("capacityNovilho")} /></label>
            <label>Médios (150–300 kg) — cabeças<input required type="number" min="1" value={form.capacityMedio} onChange={update("capacityMedio")} /></label>
            <label>Grandes (&gt;300 kg) — cabeças<input required type="number" min="1" value={form.capacityGrande} onChange={update("capacityGrande")} /></label>
            <label>R$/cabeça/mês — novilho<input required type="number" min="0.01" step="0.01" value={form.monthlyRateNovilho} onChange={update("monthlyRateNovilho")} /></label>
            <label>R$/cabeça/mês — médio<input required type="number" min="0.01" step="0.01" value={form.monthlyRateMedio} onChange={update("monthlyRateMedio")} /></label>
            <label>R$/cabeça/mês — grande<input required type="number" min="0.01" step="0.01" value={form.monthlyRateGrande} onChange={update("monthlyRateGrande")} /></label>
            <label className="wide">Contato protegido<input required value={form.contact} onChange={update("contact")} placeholder="Telefone ou e-mail" /></label>
            <label className="wide">Condições e descrição<textarea rows={3} value={form.description} onChange={update("description")} placeholder="Cercas, água, manejo, período mínimo e outras condições" /></label>
            <div className="form-actions wide">
              <button className="primary rental-btn" type="submit">{editingOfferId ? "Salvar alterações" : "Publicar oferta"}</button>
              {editingOfferId && <button type="button" className="btn-secondary" onClick={() => setEditingOfferId(null)}>Cancelar edição</button>}
            </div>
          </form>
          {message && <p className="rental-message" role="status">{message}</p>}
        </section>
      )}

      {farm && (
        <section className="panel rental-section">
          <div className="panel-heading">
            <div>
              <small>PASTOS DA MINHA PROPRIEDADE</small>
              <h2>Minhas ofertas</h2>
              <p>Gerencie as ofertas publicadas na fazenda ativa.</p>
            </div>
          </div>
          {ownerOffers.length ? (
            <div className="rental-card-list">
              {ownerOffers.map((offer) => (
                <article className="rental-card" key={offer.id}>
                  <div className="rental-card-head">
                    <div className="rental-card-title">
                      <span className="status good">Publicada</span>
                      <h3>{offer.areaName} · {offer.areaSize} ha</h3>
                    </div>
                    <span className="rental-region-badge">{offer.region}</span>
                  </div>
                  <div className="rental-specs-grid">
                    <div className="spec-box">
                      <small>TOTAL DE CABEÇAS</small>
                      <strong>{offer.capacityNovilho + offer.capacityMedio + offer.capacityGrande}</strong>
                    </div>
                    <div className="spec-box">
                      <small>NOVILHO (&lt;150KG)</small>
                      <strong>{offer.capacityNovilho} cab</strong>
                      <span>R$ {offer.monthlyRateNovilho.toFixed(2)}/mês</span>
                    </div>
                    <div className="spec-box">
                      <small>MÉDIO (150-300KG)</small>
                      <strong>{offer.capacityMedio} cab</strong>
                      <span>R$ {offer.monthlyRateMedio.toFixed(2)}/mês</span>
                    </div>
                    <div className="spec-box">
                      <small>GRANDE (&gt;300KG)</small>
                      <strong>{offer.capacityGrande} cab</strong>
                      <span>R$ {offer.monthlyRateGrande.toFixed(2)}/mês</span>
                    </div>
                  </div>
                  {offer.description && <p className="rental-desc">{offer.description}</p>}
                  <div className="rental-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => editOffer(offer)}>Editar</button>
                    <button type="button" className="btn-danger" onClick={() => closeOffer(offer.id)}>Encerrar oferta</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="agenda-empty"><strong>Nenhuma oferta publicada</strong><p>Cadastre uma oferta acima para começar.</p></div>
          )}
        </section>
      )}

      <section className="panel rental-section">
        <div className="panel-heading rental-explore-head">
          <div>
            <small>EXPLORAR DISPONIBILIDADES</small>
            <h2>Ofertas disponíveis</h2>
            <p>O contato só aparece após a solicitação formal.</p>
          </div>
          <div className="rental-search-bar">
            <input aria-label="Filtrar por região" placeholder="Buscar por região..." value={region} onChange={(event) => setRegion(event.target.value)} />
            <input aria-label="Capacidade mínima" type="number" min="0" placeholder="Mín. cabeças" value={minCapacity} onChange={(event) => setMinCapacity(event.target.value)} />
          </div>
        </div>
        {offers.length ? (
          <div className="rental-card-list">
            {offers.map((offer) => (
              <article className="rental-card" key={offer.id}>
                <div className="rental-card-head">
                  <div className="rental-card-title">
                    <span className="status good">{offer.region}</span>
                    <h3>{offer.areaName} · {offer.areaSize} ha</h3>
                  </div>
                </div>
                <div className="rental-specs-grid">
                  <div className="spec-box">
                    <small>NOVILHO (&lt;150KG)</small>
                    <strong>{offer.capacityNovilho} cab</strong>
                    <span>R$ {offer.monthlyRateNovilho.toFixed(2)}/mês</span>
                  </div>
                  <div className="spec-box">
                    <small>MÉDIO (150-300KG)</small>
                    <strong>{offer.capacityMedio} cab</strong>
                    <span>R$ {offer.monthlyRateMedio.toFixed(2)}/mês</span>
                  </div>
                  <div className="spec-box">
                    <small>GRANDE (&gt;300KG)</small>
                    <strong>{offer.capacityGrande} cab</strong>
                    <span>R$ {offer.monthlyRateGrande.toFixed(2)}/mês</span>
                  </div>
                </div>
                <p className="rental-desc">{offer.description || "Sem condições adicionais informadas."}</p>
                <div className="rental-card-actions">
                  <button className="primary rental-btn" onClick={() => requestContact(offer.id)}>Solicitar contato</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="agenda-empty"><strong>Nenhuma oferta encontrada</strong><p>Ajuste os filtros ou publique uma área livre.</p></div>
        )}
      </section>
    </>
  );
}

function PersistentStat({ label, value, unit, warning, icon }: { label: string; value: string; unit: string; warning?: boolean; icon: string }) {
  return (
    <article className={`stat-card ${warning ? "warn" : ""}`}>
      <div className="stat-icon">{icon}</div>
      <small>{label}</small>
      <div><strong>{value}</strong><span>{unit}</span></div>
    </article>
  );
}

function FarmDialog({ farm, onClose, onSave, error }: { farm: Farm | null; onClose: () => void; onSave: (data: FormData) => void; error: string }) {
  return (
    <div className="modal-backdrop">
      <dialog open className="modal">
        <form action={onSave}>
          <div className="modal-head">
            <div><small>CADASTRO PERSISTENTE</small><h2>{farm ? "Editar fazenda" : "Cadastrar fazenda"}</h2></div>
            <button type="button" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="form-grid">
            <label className="wide">Nome da fazenda<input name="name" required defaultValue={farm?.name} /></label>
            <label className="wide">Área total (hectares)<input name="totalArea" type="number" min="0.01" step="0.01" required defaultValue={farm?.totalArea} /></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary" type="submit">Salvar fazenda</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function AreaDialog({ farm, area, onClose, onSave, error }: { farm: Farm; area: Area | null; onClose: () => void; onSave: (data: FormData) => void; error: string }) {
  return (
    <div className="modal-backdrop">
      <dialog open className="modal">
        <form action={onSave}>
          <div className="modal-head">
            <div><small>{farm.name.toUpperCase()}</small><h2>{area ? "Editar área" : "Cadastrar área"}</h2></div>
            <button type="button" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="form-grid">
            <label>Nome da área<input name="name" required defaultValue={area?.name} placeholder="Ex.: Piquete Norte" /></label>
            <label>Tamanho (hectares)<input name="size" type="number" min="0.01" step="0.01" required defaultValue={area?.size} /></label>
            <label>Capacidade máxima (cabeças)<input name="maxCapacity" type="number" min="1" step="1" required defaultValue={area?.maxCapacity ?? 1} /></label>
            <label className="wide">Observações<input name="notes" defaultValue={area?.notes} placeholder="Condição, uso ou detalhes" /></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary" type="submit">Salvar área</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function TaskDialog({ task, onClose, onSave, error }: { task: PersistedTask | null; onClose: () => void; onSave: (data: FormData) => void; error: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="modal-backdrop">
      <dialog open className="modal">
        <form action={onSave}>
          <div className="modal-head">
            <div><small>AGENDA PERSISTENTE</small><h2>{task ? "Editar atividade" : "Nova atividade"}</h2></div>
            <button type="button" onClick={onClose} aria-label="Fechar">×</button>
          </div>
          <div className="form-grid">
            <label className="wide">Título<input name="title" required defaultValue={task?.title ?? "Remanejamento"} /></label>
            <label>Categoria<select name="type" defaultValue={task?.type ?? "Pastagem"}><option>Pastagem</option><option>Sanidade</option><option>Operação</option></select></label>
            <label>Data planejada<input name="dueDate" type="date" required defaultValue={task?.dueDate ?? today} /></label>
            <label>Lote<input name="lote" defaultValue={task?.lote ?? ""} /></label>
            <label>Origem<input name="origin" defaultValue={task?.origin ?? ""} /></label>
            <label>Destino<input name="destination" defaultValue={task?.destination ?? ""} /></label>
            <label className="wide">Detalhes<input name="details" defaultValue={task?.details ?? ""} /></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary" type="submit">Salvar atividade</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); }
function monthName(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(); }
