"use client";

import { useEffect, useState } from "react";
import { areaApi, farmApi, taskApi, type Area, type Farm, type ManagementTask as PersistedTask } from "@/lib/api";

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
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<PersistedTask[]>([]);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingTask, setEditingTask] = useState<PersistedTask | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function showError(value: unknown) { setError(value instanceof Error ? value.message : "Não foi possível concluir a operação."); }
  function showNotice(value: string) { setNotice(value); window.setTimeout(() => setNotice(""), 3000); }
  function loadFarmData(selected: Farm) {
    void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id)]).then(([areaResult, taskResult]) => {
      setAreas(areaResult.areas); setTasks(taskResult.tasks);
    }).catch(showError);
  }

  useEffect(() => {
    void farmApi.list().then(({ farms: values }) => {
      if (values[0]) {
        const selected = values[0];
        setFarm(selected);
        void Promise.all([areaApi.list(selected.id), taskApi.list(selected.id)]).then(([areaResult, taskResult]) => {
          setAreas(areaResult.areas); setTasks(taskResult.tasks);
        }).catch(showError);
      }
    }).catch(showError);
  }, []);

  const mappedArea = areas.reduce((total, area) => total + Number(area.size), 0);
  const pendingTasks = tasks.filter((task) => task.status === "pending");

  async function saveFarm(formData: FormData) {
    setError("");
    try {
      const payload = { name: String(formData.get("name") ?? ""), totalArea: Number(formData.get("totalArea")) };
      const result = farm ? await farmApi.update(farm.id, payload) : await farmApi.create(payload);
      const saved = result.farm;
      setFarm(saved);
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("visao")} aria-label="Ir para visão geral"><span className="brand-mark"><i /><i /><i /></span><span>PASTO<span>FLUX</span></span></button>
        <button className="farm-switcher" onClick={() => { setError(""); setDialog("farm"); }} aria-label="Cadastrar ou editar fazenda"><span className="farm-avatar">{farm?.name.slice(0, 2).toUpperCase() ?? "PF"}</span><span><small>PROPRIEDADE</small><strong>{farm?.name ?? "Cadastre sua fazenda"}</strong></span><b>⌄</b></button>
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
          {view === "pastagens" && <AreasView farm={farm} areas={areas} mappedArea={mappedArea} openArea={openArea} />}
          {view === "agenda" && <AgendaPersisted farm={farm} tasks={tasks} openTask={openTask} toggleTask={toggleTask} />}
          {view === "simulador" && <SimulatorPersisted onSchedule={() => openTask()} />}
          {view === "rebanho" && <StaticModule eyebrow="CONTROLE DO REBANHO" title="Animais e lotes" text="O cadastro persistente de rebanho está planejado para a próxima Sprint. Os dados demonstrativos do protótipo foram preservados fora do fluxo persistente." />}
          {view === "aluguel" && <StaticModule eyebrow="REDE DE PASTAGENS" title="Disponibilidade e aluguel" text="As ofertas de aluguel continuam demonstrativas nesta etapa. A Sprint 2 concentra a persistência em fazenda, áreas e agenda." />}
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

function AreasView({ farm, areas, mappedArea, openArea }: { farm: Farm | null; areas: Area[]; mappedArea: number; openArea: (area?: Area) => void }) {
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
  const days = Math.max(1, Math.round((area * 8 * (availability / 100)) / Math.max(animals, 1)));

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

function StaticModule({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <>
      <PageHeading eyebrow={eyebrow} title={title} text={text} />
      <div className="agenda-empty">
        <strong>Módulo demonstrativo preservado</strong>
        <p>{text}</p>
      </div>
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
