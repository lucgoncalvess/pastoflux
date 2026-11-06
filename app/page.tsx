"use client";

import { useCallback, useEffect, useState } from "react";
import { animalApi, areaApi, farmApi, herdStatsApi, lotApi, measurementApi, movementApi, occupationApi, rentalApi, taskApi, type Animal, type Area, type Farm, type Lot, type ManagementTask as PersistedTask, type RentalOffer } from "@/lib/api";
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
  const [dialog, setDialog] = useState<DialogName>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingTask, setEditingTask] = useState<PersistedTask | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const showError = useCallback((value: unknown) => { setError(value instanceof Error ? value.message : "Não foi possível concluir a operação."); }, []);
  const showNotice = useCallback((value: string) => { setNotice(value); window.setTimeout(() => setNotice(""), 3000); }, []);
  function loadFarmData(selected: Farm) {
    void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id), animalApi.list(selected.id), lotApi.list(selected.id), occupationApi.list(selected.id)]).then(([areaResult, taskResult, animalResult, lotResult, occupationResult]) => {
      setAreas(areaResult.areas); setTasks(taskResult.tasks); setAnimals(animalResult.animals); setLots(lotResult.lots); setOccupations(occupationResult.occupations);
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
        void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id), animalApi.list(selected.id), lotApi.list(selected.id), occupationApi.list(selected.id)]).then(([areaResult, taskResult, animalResult, lotResult, occupationResult]) => {
          setAreas(areaResult.areas); setTasks(taskResult.tasks); setAnimals(animalResult.animals); setLots(lotResult.lots); setOccupations(occupationResult.occupations);
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
      const payload = { farmId: farm.id, name: String(formData.get("name") ?? ""), size: Number(formData.get("size")), notes: String(formData.get("notes") ?? "") };
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
          {view === "visao" && <OverviewPersisted farm={farm} mappedArea={mappedArea} areas={areas.length} pending={pendingTasks.length} openFarm={() => setDialog("farm")} openArea={() => openArea()} openTask={() => openTask()} />}
          {view === "fazenda" && <FarmView farm={farm} mappedArea={mappedArea} areaCount={areas.length} openFarm={() => setDialog("farm")} />}
          {view === "pastagens" && <AreasView farm={farm} areas={areas} mappedArea={mappedArea} openArea={openArea} occupations={occupations} />}
          {view === "agenda" && <AgendaPersisted farm={farm} tasks={tasks} openTask={openTask} toggleTask={toggleTask} />}
          {view === "simulador" && <SimulatorPersisted onSchedule={() => openTask()} />}
          {view === "rebanho" && <HerdView farm={farm} areas={areas} animals={animals} lots={lots} onAnimal={(animal) => setAnimals((values) => [...values, animal])} onLot={(lot) => setLots((values) => [...values, lot])} onMovement={() => farm && loadFarmData(farm)} />}
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

function OverviewPersisted({ farm, mappedArea, areas, pending, openFarm, openArea, openTask }: { farm: Farm | null; mappedArea: number; areas: number; pending: number; openFarm: () => void; openArea: () => void; openTask: () => void }) {
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
            {areas.length ? areas.map((area) => (
              <article className="pasture-card" key={area.id}>
                <div className="pasture-top"><span className="status good">Cadastrada</span><button onClick={() => openArea(area)} aria-label={`Editar ${area.name}`}>•••</button></div>
                <h3>{area.name}</h3>
                <p>{area.size} hectares</p>
                <div className="level-label"><span>Participação na fazenda</span><b>{Math.round((area.size / farm.totalArea) * 100)}%</b></div>
                <div className="progress"><i className="good" style={{ width: `${Math.min(100, (area.size / farm.totalArea) * 100)}%` }} /></div>
                <small>{area.notes || "Sem observações"}</small>
                <span className="status">{occupations.find((item) => item.areaId === area.id)?.status ?? "DISPONIVEL"}</span>
                <MeasurementForm farmId={farm.id} areaId={area.id} />
              </article>
            )) : (
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await measurementApi.create({ farmId, areaId, measuredAt: new Date().toISOString().slice(0, 10), availability: Number(availability), source: "manual", notes: "" });
      setAvailability(""); setMessage("Medição registrada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível registrar."); }
  }
  return <form onSubmit={submit} className="measurement-form"><label>Disponibilidade (%)<input type="number" min="0" max="100" required value={availability} onChange={(event) => setAvailability(event.target.value)} /></label><button type="submit">Registrar</button>{message && <small role="status">{message}</small>}</form>;
}

function HerdView({ farm, areas, animals, lots, onAnimal, onLot, onMovement }: { farm: Farm | null; areas: Area[]; animals: Animal[]; lots: Lot[]; onAnimal: (animal: Animal) => void; onLot: (lot: Lot) => void; onMovement: () => void }) {
  const [identification, setIdentification] = useState("");
  const [category, setCategory] = useState("Gado");
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
    try { const { animal } = await animalApi.create({ farmId: activeFarm.id, identification, category, weight: null, birthDate: null, active: true }); onAnimal(animal); setIdentification(""); setMessage("Animal cadastrado."); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar."); }
  }
  async function addLot(event: React.FormEvent) {
    event.preventDefault();
    try { const { lot } = await lotApi.create({ farmId: activeFarm.id, name: lotName }); onLot(lot); setLotName(""); setMessage("Lote cadastrado."); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar."); }
  }
  async function moveLot(event: React.FormEvent) {
    event.preventDefault();
    try {
      await movementApi.create({ farmId: activeFarm.id, lotId: Number(lotId), origin: areas.find((item) => item.id === Number(originAreaId))?.name ?? null, destination: areas.find((item) => item.id === Number(destinationAreaId))?.name ?? "", originAreaId: originAreaId ? Number(originAreaId) : null, destinationAreaId: Number(destinationAreaId), movedAt: new Date().toISOString().slice(0, 10), quantity: animals.length, recoveryDays: 0 });
      setMessage("Movimentação registrada."); onMovement();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível movimentar o lote."); }
  }
  return <><PageHeading eyebrow="CONTROLE DO REBANHO" title="Animais e lotes" text="Cadastre o rebanho persistente e organize os animais por lote." />
    <section className="panel"><form onSubmit={addAnimal} className="form-grid"><label>Identificação<input required value={identification} onChange={(event) => setIdentification(event.target.value)} /></label><label>Categoria<input required value={category} onChange={(event) => setCategory(event.target.value)} /></label><button className="primary" type="submit">Cadastrar animal</button></form>
    <form onSubmit={addLot} className="form-grid"><label>Nome do lote<input required value={lotName} onChange={(event) => setLotName(event.target.value)} /></label><button className="primary" type="submit">Cadastrar lote</button></form>{message && <p role="status">{message}</p>}
    <form onSubmit={moveLot} className="form-grid"><label>Lote<select required value={lotId} onChange={(event) => setLotId(event.target.value)}><option value="">Selecione</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></label><label>Origem<select value={originAreaId} onChange={(event) => setOriginAreaId(event.target.value)}><option value="">Sem origem</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Destino<select required value={destinationAreaId} onChange={(event) => setDestinationAreaId(event.target.value)}><option value="">Selecione</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><button className="primary" type="submit">Movimentar lote</button></form>
    <div className="summary-strip"><span><small>ANIMAIS ATIVOS</small><strong>{stats?.heads ?? animals.filter((animal) => animal.active).length}</strong></span><span><small>PESO MÉDIO</small><strong>{Number(stats?.averageWeight ?? 0).toFixed(1)} kg</strong></span><span><small>LOTES</small><strong>{lots.length}</strong></span></div>
    <label>Filtrar categoria<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas</option>{Array.from(new Set(animals.map((animal) => animal.category))).map((item) => <option key={item}>{item}</option>)}</select></label>
    <ul>{animals.map((animal) => <li key={animal.id}>{animal.identification} · {animal.category}</li>)}</ul></section></>;
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
      {farm && <section className="panel">
        <h2>{editingOfferId ? "Editar oferta de aluguel" : "Publicar área para aluguel"}</h2>
        <form onSubmit={publish} className="form-grid">
          <label>Área<select required value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Selecione uma área livre</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.size} ha</option>)}</select></label>
          <label>Região<input required value={form.region} onChange={update("region")} placeholder="Ex.: Sul de Minas" /></label>
          <label>Novilhos (&lt;150 kg) — cabeças<input required type="number" min="1" value={form.capacityNovilho} onChange={update("capacityNovilho")} /></label>
          <label>Médios (150–300 kg) — cabeças<input required type="number" min="1" value={form.capacityMedio} onChange={update("capacityMedio")} /></label>
          <label>Grandes (&gt;300 kg) — cabeças<input required type="number" min="1" value={form.capacityGrande} onChange={update("capacityGrande")} /></label>
          <label>R$/cabeça/mês — novilho<input required type="number" min="0.01" step="0.01" value={form.monthlyRateNovilho} onChange={update("monthlyRateNovilho")} /></label>
          <label>R$/cabeça/mês — médio<input required type="number" min="0.01" step="0.01" value={form.monthlyRateMedio} onChange={update("monthlyRateMedio")} /></label>
          <label>R$/cabeça/mês — grande<input required type="number" min="0.01" step="0.01" value={form.monthlyRateGrande} onChange={update("monthlyRateGrande")} /></label>
          <label>Contato protegido<input required value={form.contact} onChange={update("contact")} placeholder="Telefone ou e-mail" /></label>
          <label className="wide">Condições e descrição<textarea value={form.description} onChange={update("description")} placeholder="Cercas, água, manejo, período mínimo e outras condições" /></label>
          <button className="primary" type="submit">{editingOfferId ? "Salvar alterações" : "Publicar oferta"}</button>
          {editingOfferId && <button type="button" onClick={() => setEditingOfferId(null)}>Cancelar edição</button>}
        </form>
        {message && <p role="status">{message}</p>}
      </section>}
      {farm && <section className="panel">
        <div className="panel-heading"><div><h2>Minhas ofertas</h2><p>Gerencie as ofertas publicadas na fazenda ativa.</p></div></div>
        {ownerOffers.length ? <div className="agenda-list">{ownerOffers.map((offer) => <article className="agenda-item" key={offer.id}><div className="agenda-copy"><span className="status good">Publicada</span><h2>{offer.areaName} · {offer.areaSize} ha</h2><p>{offer.region} · {offer.capacityNovilho + offer.capacityMedio + offer.capacityGrande} cabeças totais</p></div><div className="task-actions"><button onClick={() => editOffer(offer)}>Editar</button><button onClick={() => closeOffer(offer.id)}>Encerrar oferta</button></div></article>)}</div> : <div className="agenda-empty"><strong>Nenhuma oferta publicada</strong><p>Cadastre uma oferta acima para começar.</p></div>}
      </section>}
      <section className="panel">
        <div className="panel-heading"><div><h2>Ofertas disponíveis</h2><p>O contato só aparece após a solicitação formal.</p></div><div className="form-grid"><input aria-label="Filtrar por região" placeholder="Região" value={region} onChange={(event) => setRegion(event.target.value)} /><input aria-label="Capacidade mínima" type="number" min="0" placeholder="Cabeças mín." value={minCapacity} onChange={(event) => setMinCapacity(event.target.value)} /></div></div>
        {offers.length ? <div className="agenda-list">{offers.map((offer) => <article className="agenda-item" key={offer.id}><div className="agenda-copy"><span className="status good">{offer.region}</span><h2>{offer.areaName} · {offer.areaSize} ha</h2><p>Lotação: {offer.capacityNovilho} novilhos · {offer.capacityMedio} médios · {offer.capacityGrande} grandes</p><p>Mensal: R$ {offer.monthlyRateNovilho.toFixed(2)} / R$ {offer.monthlyRateMedio.toFixed(2)} / R$ {offer.monthlyRateGrande.toFixed(2)} por cabeça</p><p>{offer.description || "Sem condições adicionais informadas."}</p></div><div className="task-actions"><button className="primary" onClick={() => requestContact(offer.id)}>Solicitar contato</button></div></article>)}</div> : <div className="agenda-empty"><strong>Nenhuma oferta encontrada</strong><p>Ajuste os filtros ou publique uma área livre.</p></div>}
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
