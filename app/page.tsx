"use client";

import { useEffect, useMemo, useState } from "react";

type View = "visao" | "rebanho" | "pastagens" | "simulador" | "agenda" | "aluguel";
type Animal = { id: string; brinco: string; categoria: string; idade: number; peso: number; lote: string };
type ManagementTask = {
  id: string;
  title: string;
  type: "Pastagem" | "Sanidade";
  lote: string;
  origin?: string;
  destination?: string;
  date: string;
  status: "pending" | "completed";
  details: string;
};

const DEMO_TODAY = "2026-08-20";
const initialTasks: ManagementTask[] = [
  { id: "vacina-lote-c", title: "Vacinação · Lote C", type: "Sanidade", lote: "Lote C", date: "2026-08-21", status: "pending", details: "22 bezerros · Curral principal" },
];

const initialAnimals: Animal[] = [
  { id: "1", brinco: "BR-1042", categoria: "Novilha", idade: 22, peso: 318, lote: "Lote A" },
  { id: "2", brinco: "BR-0987", categoria: "Vaca", idade: 48, peso: 462, lote: "Lote B" },
  { id: "3", brinco: "BR-1108", categoria: "Bezerro", idade: 8, peso: 184, lote: "Lote C" },
  { id: "4", brinco: "BR-1015", categoria: "Garrote", idade: 17, peso: 276, lote: "Lote A" },
];

const pastureData = [
  { name: "Piquete Norte", area: 24, animals: 48, level: 18, status: "Atenção", tone: "warning", recovery: 24 },
  { name: "Piquete Central", area: 18, animals: 36, level: 62, status: "Em uso", tone: "active", recovery: 16 },
  { name: "Piquete Sul", area: 20, animals: 0, level: 91, status: "Disponível", tone: "good", recovery: 3 },
  { name: "Reserva Leste", area: 10, animals: 22, level: 44, status: "Em uso", tone: "active", recovery: 11 },
];

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "visao", label: "Visão geral", icon: "⌂" },
  { id: "rebanho", label: "Rebanho", icon: "◉" },
  { id: "pastagens", label: "Pastagens", icon: "⌁" },
  { id: "simulador", label: "Simulador", icon: "↗" },
  { id: "agenda", label: "Agenda", icon: "□" },
  { id: "aluguel", label: "Aluguel", icon: "◇" },
];

export default function Home() {
  const [view, setView] = useState<View>("visao");
  const [animals, setAnimals] = useState(initialAnimals);
  const [modal, setModal] = useState<"animal" | "pasto" | "manejo" | null>(null);
  const [toast, setToast] = useState("");
  const [resolved, setResolved] = useState(false);
  const [search, setSearch] = useState("");
  const [sim, setSim] = useState({ animals: 48, area: 24, availability: 18, recovery: 28 });
  const [tour, setTour] = useState(0);
  const [tasks, setTasks] = useState<ManagementTask[]>(initialTasks);
  const [tasksReady, setTasksReady] = useState(false);
  const [editingTask, setEditingTask] = useState<ManagementTask | null>(null);

  useEffect(() => {
    const loadSavedTasks = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("pastoflux-management-tasks");
        if (saved) {
          const storedTasks = JSON.parse(saved) as ManagementTask[];
          setTasks(storedTasks);
          setResolved(storedTasks.some((task) => task.type === "Pastagem" && task.lote === "Lote A" && task.status === "pending"));
        }
      } catch { /* Mantém os dados demonstrativos se o armazenamento estiver indisponível. */ }
      setTasksReady(true);
    }, 0);
    return () => window.clearTimeout(loadSavedTasks);
  }, []);

  useEffect(() => {
    if (!tasksReady) return;
    try { window.localStorage.setItem("pastoflux-management-tasks", JSON.stringify(tasks)); } catch { /* O protótipo continua funcional durante a sessão. */ }
  }, [tasks, tasksReady]);

  const simulation = useMemo(() => {
    const days = Math.max(1, Math.round((sim.area * 8 * (sim.availability / 100)) / Math.max(sim.animals, 1)));
    return { days };
  }, [sim]);

  const filteredAnimals = animals.filter((animal) =>
    `${animal.brinco} ${animal.categoria} ${animal.lote}`.toLowerCase().includes(search.toLowerCase())
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function addAnimal(formData: FormData) {
    const newAnimal: Animal = {
      id: String(Date.now()), brinco: String(formData.get("brinco") || "BR-0000"),
      categoria: String(formData.get("categoria") || "Vaca"), idade: Number(formData.get("idade") || 0),
      peso: Number(formData.get("peso") || 0), lote: String(formData.get("lote") || "Lote A"),
    };
    setAnimals((current) => [newAnimal, ...current]);
    setModal(null); notify(`${newAnimal.brinco} cadastrado com sucesso.`);
  }

  function addManagement(formData: FormData) {
    const lote = String(formData.get("lote") || "Lote A");
    const origin = String(formData.get("origem") || "Piquete Norte");
    const destination = String(formData.get("destino") || "Piquete Sul");
    const date = String(formData.get("data") || addDemoDays(simulation.days));
    const newTask: ManagementTask = {
      id: String(Date.now()),
      title: `Remanejamento · ${lote}`,
      type: "Pastagem",
      lote,
      origin,
      destination,
      date,
      status: "pending",
      details: `${origin} → ${destination} · ${sim.animals} animais`,
    };
    setTasks((current) => [newTask, ...current]);
    if (lote === "Lote A" && origin === "Piquete Norte") setResolved(true);
    setModal(null);
    setView("agenda");
    notify("Manejo adicionado à agenda.");
  }

  function registerRecommendedManagement() {
    const exists = tasks.some((task) => task.type === "Pastagem" && task.lote === "Lote A" && task.status === "pending");
    if (!exists) {
      setTasks((current) => [{
        id: String(Date.now()), title: "Remanejamento · Lote A", type: "Pastagem", lote: "Lote A",
        origin: "Piquete Norte", destination: "Piquete Sul", date: "2026-08-24", status: "pending",
        details: "Piquete Norte → Piquete Sul · 48 animais",
      }, ...current]);
    }
    setResolved(true);
    notify(exists ? "O remanejamento já está na agenda." : "Remanejamento registrado na agenda.");
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === "pending" ? "completed" : "pending" } : task));
  }

  function updateTask(formData: FormData) {
    if (!editingTask) return;
    const updatedTask: ManagementTask = {
      ...editingTask,
      title: String(formData.get("titulo") || editingTask.title),
      type: String(formData.get("tipo") || editingTask.type) as ManagementTask["type"],
      lote: String(formData.get("lote") || editingTask.lote),
      date: String(formData.get("data") || editingTask.date),
      details: String(formData.get("detalhes") || editingTask.details),
    };
    setTasks((current) => current.map((task) => task.id === editingTask.id ? updatedTask : task));
    setEditingTask(null);
    notify("Atividade atualizada com sucesso.");
  }

  function startTour() { setTour(1); setView("visao"); }
  function nextTour() {
    const next = tour + 1;
    if (next === 2) setView("pastagens"); if (next === 3) setView("simulador"); if (next === 4) setView("aluguel");
    if (next > 4) { setTour(0); setView("visao"); notify("Demonstração concluída."); } else setTour(next);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("visao")} aria-label="Ir para visão geral">
          <span className="brand-mark"><i /><i /><i /></span><span>PASTO<span>FLUX</span></span>
        </button>
        <div className="farm-switcher"><span className="farm-avatar">SL</span><span><small>PROPRIEDADE</small><strong>Fazenda Santa Luzia</strong></span><b>⌄</b></div>
        <nav aria-label="Navegação principal"><small>GESTÃO</small>{navItems.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "visao" && !resolved && <em>2</em>}</button>
        ))}</nav>
        <div className="sidebar-card"><span className="signal"><i /><i /><i /></span><div><strong>Dados sincronizados</strong><small>Atualizado agora</small></div></div>
        <div className="profile"><span>LM</span><div><strong>Lucas Mendes</strong><small>Administrador</small></div><b>•••</b></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="mobile-brand">PASTO<span>FLUX</span></div><div className="breadcrumb">Fazenda Santa Luzia <span>/</span> {navItems.find((n) => n.id === view)?.label}</div><div className="top-actions"><button className="tour-button" onClick={startTour}>▶ Modo apresentação</button><button className="icon-button" aria-label="Notificações">♢<i /></button><span className="today">20 AGO 2026</span></div></header>
        <div className="mobile-nav">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>
        <div className="content">
          {view === "visao" && <Overview animals={animals.length} resolved={resolved} setResolved={setResolved} setView={setView} notify={notify} setModal={setModal} tasks={tasks} onRegisterManagement={registerRecommendedManagement} />}
          {view === "rebanho" && <Herd animals={filteredAnimals} search={search} setSearch={setSearch} setModal={setModal} />}
          {view === "pastagens" && <Pastures resolved={resolved} setView={setView} />}
          {view === "simulador" && <Simulator sim={sim} setSim={setSim} result={simulation} onSchedule={() => setModal("manejo")} />}
          {view === "agenda" && <Agenda tasks={tasks} onToggle={toggleTask} onEdit={setEditingTask} setView={setView} />}
          {view === "aluguel" && <Rental setModal={setModal} notify={notify} />}
        </div>
      </section>

      {tour > 0 && <div className="tour-dock" role="status"><div><small>DEMONSTRAÇÃO · {tour}/4</small><strong>{["", "Comece pela situação da fazenda", "Mostre a condição de cada pasto", "Simule e explique a recomendação", "Finalize com o aluguel integrado"][tour]}</strong></div><div><button onClick={() => setTour(0)}>Sair</button><button className="primary" onClick={nextTour}>{tour === 4 ? "Concluir" : "Próximo"} →</button></div></div>}
      {modal === "animal" && <AnimalModal onClose={() => setModal(null)} onSubmit={addAnimal} />}
      {modal === "pasto" && <PastureModal onClose={() => setModal(null)} onSubmit={() => { setModal(null); notify("Pasto anunciado para aluguel."); }} />}
      {modal === "manejo" && <ManagementModal onClose={() => setModal(null)} onSubmit={addManagement} suggestedDate={addDemoDays(simulation.days)} animals={sim.animals} />}
      {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} onSubmit={updateTask} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-title"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function Overview({ animals, resolved, setResolved, setView, notify, setModal, tasks, onRegisterManagement }: { animals: number; resolved: boolean; setResolved: (v: boolean) => void; setView: (v: View) => void; notify: (v: string) => void; setModal: (v: "animal" | "pasto") => void; tasks: ManagementTask[]; onRegisterManagement: () => void }) {
  const nextTasks = tasks.filter((task) => task.status === "pending").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return <>
    <PageTitle eyebrow="QUINTA-FEIRA, 20 DE AGOSTO" title="Bom dia, Lucas." description="Aqui está o que exige atenção hoje na Fazenda Santa Luzia." action={<button className="primary big" onClick={() => setModal("animal")}>＋ Cadastrar animal</button>} />
    <section className="stat-grid"><Stat label="REBANHO TOTAL" value={String(182 + animals)} unit="animais" change="+6 este mês" icon="◉" /><Stat label="ÁREA MAPEADA" value="72" unit="hectares" detail="4 piquetes" icon="⌁" /><Stat label="PASTO DISPONÍVEL" value="1" unit="piquete" detail="20 ha livres" icon="▱" /><Stat label="ALERTAS ATIVOS" value={resolved ? "1" : "2"} unit="pendências" warning detail={resolved ? "1 tarefa sanitária" : "1 exige ação hoje"} icon="!" /></section>
    {!resolved ? <section className="critical-card"><div className="critical-icon">!</div><div className="critical-copy"><small>ALERTA DE PASTAGEM · ALTA PRIORIDADE</small><h2>Piquete Norte pode atingir o limite em 4 dias</h2><p>O lote com 48 animais consome o pasto mais rápido que a recuperação estimada. O Piquete Sul está disponível para remanejamento.</p><div className="recommendation"><span>RECOMENDAÇÃO</span><strong>Remanejar o Lote A até 24 de agosto</strong><small>Destino sugerido: Piquete Sul · 20 ha · 91% disponível</small></div></div><div className="critical-actions"><button className="primary" onClick={onRegisterManagement}>Registrar remanejamento</button><button onClick={() => setView("simulador")}>Abrir simulação</button></div></section> : <section className="success-card"><span>✓</span><div><small>MANEJO REGISTRADO</small><h2>Lote A programado para o Piquete Sul</h2><p>O alerta foi resolvido. Consulte ou conclua a movimentação na agenda.</p></div><button onClick={() => { setResolved(false); notify("Alerta reaberto."); }}>Reabrir alerta</button></section>}
    <section className="section-row"><div><small>VISÃO DAS PASTAGENS</small><h2>Condição atual dos piquetes</h2></div><button onClick={() => setView("pastagens")}>Ver todas as pastagens →</button></section>
    <section className="pasture-grid compact">{pastureData.map((p) => <PastureCard key={p.name} pasture={p} />)}</section>
    <section className="bottom-grid"><div className="panel"><div className="panel-head"><div><small>PRÓXIMAS ATIVIDADES</small><h2>Agenda de manejo</h2></div><button onClick={() => setView("agenda")}>Ver agenda →</button></div>{nextTasks.length ? nextTasks.map((task) => <CompactTask key={task.id} task={task} />) : <div className="agenda-empty compact-empty"><strong>Nenhum manejo pendente</strong><p>Use o simulador para planejar a próxima movimentação.</p></div>}</div><div className="panel decision"><small>DECISÃO EM NÚMEROS</small><h2>4 dias</h2><p>até o limite estimado do Piquete Norte</p><div><span><b>48</b> animais</span><span><b>24 ha</b> de área</span><span><b>18%</b> disponível</span></div><button onClick={() => setView("simulador")}>Testar outro cenário →</button></div></section>
  </>;
}

function Stat({ label, value, unit, detail, change, warning, icon }: { label: string; value: string; unit: string; detail?: string; change?: string; warning?: boolean; icon: string }) { return <article className={`stat-card ${warning ? "warn" : ""}`}><div className="stat-icon">{icon}</div><small>{label}</small><div><strong>{value}</strong><span>{unit}</span></div>{change ? <em>↗ {change}</em> : <p>{detail}</p>}</article>; }
function PastureCard({ pasture }: { pasture: typeof pastureData[number] }) { return <article className="pasture-card"><div className="pasture-top"><span className={`status ${pasture.tone}`}>{pasture.status}</span><button aria-label={`Opções de ${pasture.name}`}>•••</button></div><h3>{pasture.name}</h3><p>{pasture.area} hectares · {pasture.animals ? `${pasture.animals} animais` : "sem animais"}</p><div className="level-label"><span>Disponibilidade estimada</span><b>{pasture.level}%</b></div><div className="progress"><i style={{ width: `${pasture.level}%` }} className={pasture.tone} /></div><small>{pasture.animals ? `${pasture.recovery} dias para recuperação` : "Pronto para receber um lote"}</small></article>; }

function Herd({ animals, search, setSearch, setModal }: { animals: Animal[]; search: string; setSearch: (v: string) => void; setModal: (v: "animal") => void }) { return <><PageTitle eyebrow="CONTROLE DO REBANHO" title="Animais e lotes" description="Acompanhe identificação, idade, peso e localização dos animais." action={<button className="primary big" onClick={() => setModal("animal")}>＋ Novo animal</button>} /><section className="summary-strip"><span><small>TOTAL DO REBANHO</small><strong>186</strong></span><span><small>PESO MÉDIO</small><strong>348 kg</strong></span><span><small>LOTES ATIVOS</small><strong>3</strong></span><span><small>GANHO MÉDIO</small><strong>0,72 kg/dia</strong></span></section><section className="panel table-panel"><div className="table-tools"><div><h2>Cadastro individual</h2><p>{animals.length} registros exibidos</p></div><label>⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar brinco, categoria ou lote" /></label></div><div className="data-table"><div className="table-row head"><span>BRINCO</span><span>CATEGORIA</span><span>IDADE</span><span>PESO</span><span>LOTE ATUAL</span><span>STATUS</span></div>{animals.map((a) => <div className="table-row" key={a.id}><span><b>{a.brinco}</b></span><span>{a.categoria}</span><span>{a.idade} meses</span><span>{a.peso} kg</span><span>{a.lote}</span><span><em className="status good">Ativo</em></span></div>)}</div></section></>; }

function Pastures({ resolved, setView }: { resolved: boolean; setView: (v: View) => void }) { return <><PageTitle eyebrow="GESTÃO DE PASTAGENS" title="Mapa de ocupação" description="Monitore uso, recuperação e capacidade de cada área." action={<button className="primary big" onClick={() => setView("simulador")}>↗ Nova simulação</button>} /><section className="pasture-map"><div className="map-head"><div><small>FAZENDA SANTA LUZIA</small><h2>72 hectares mapeados</h2></div><div className="legend"><span><i className="good" />Disponível</span><span><i className="active" />Em uso</span><span><i className="warning" />Atenção</span></div></div><div className="field-grid"><div className={`field north ${resolved ? "active" : "warning"}`}><small>24 HA</small><strong>PIQUETE NORTE</strong><span>{resolved ? "Remanejamento agendado" : "Limite em 4 dias"}</span></div><div className="field central active"><small>18 HA</small><strong>PIQUETE CENTRAL</strong><span>36 animais</span></div><div className="field south good"><small>20 HA</small><strong>PIQUETE SUL</strong><span>91% disponível</span></div><div className="field east active"><small>10 HA</small><strong>RESERVA LESTE</strong><span>22 animais</span></div></div></section><section className="section-row"><div><small>DETALHAMENTO</small><h2>Condição por piquete</h2></div></section><section className="pasture-grid">{pastureData.map((p) => <PastureCard key={p.name} pasture={p} />)}</section></>; }

function Simulator({ sim, setSim, result, onSchedule }: { sim: { animals: number; area: number; availability: number; recovery: number }; setSim: (v: typeof sim) => void; result: { days: number }; onSchedule: () => void }) { return <><PageTitle eyebrow="SIMULADOR DE PASTAGENS" title="Antecipe o próximo remanejamento" description="Teste cenários e transforme a recomendação em uma atividade da agenda." /><section className="sim-layout"><form className="sim-form" onSubmit={(e) => e.preventDefault()}><div className="form-head"><span>01</span><div><h2>Dados do cenário</h2><p>Ajuste os valores para atualizar o resultado.</p></div></div><label>Quantidade de animais<div><input type="number" min="1" value={sim.animals} onChange={(e) => setSim({ ...sim, animals: Number(e.target.value) })} /><span>animais</span></div></label><label>Área disponível<div><input type="number" min="1" value={sim.area} onChange={(e) => setSim({ ...sim, area: Number(e.target.value) })} /><span>hectares</span></div></label><label>Disponibilidade atual<div><input type="range" min="5" max="100" value={sim.availability} onChange={(e) => setSim({ ...sim, availability: Number(e.target.value) })} /><b>{sim.availability}%</b></div></label><label>Tempo de recuperação configurado<div><input type="number" min="1" value={sim.recovery} onChange={(e) => setSim({ ...sim, recovery: Number(e.target.value) })} /><span>dias</span></div></label><button className="secondary" type="button" onClick={() => setSim({ animals: 48, area: 24, availability: 18, recovery: 28 })}>Restaurar cenário do alerta</button></form><div className="sim-result"><div className="result-head"><span>RESULTADO ATUALIZADO</span><i>● ao vivo</i></div><div className="result-number"><strong>{result.days}</strong><span>dias</span></div><h2>até atingir o limite estimado</h2><p>Com {sim.animals} animais em {sim.area} hectares e {sim.availability}% de disponibilidade.</p><div className="formula"><small>COMO CHEGAMOS NISSO</small><p><b>Área × capacidade × disponibilidade</b><span>÷ quantidade de animais</span></p><code>({sim.area} × 8 × {sim.availability / 100}) ÷ {sim.animals} ≈ {result.days} dias</code></div><div className="result-alert"><span>!</span><div><strong>Recomendação</strong><p>Planeje o remanejamento em até <b>{result.days} dias</b>. O pasto precisará de aproximadamente {sim.recovery} dias de descanso.</p></div></div><button className="primary big full" onClick={onSchedule}>Agendar remanejamento</button></div></section><p className="disclaimer">Estimativa demonstrativa baseada nos dados cadastrados. A decisão final deve considerar avaliação de campo e orientação técnica.</p></>; }

function Agenda({ tasks, onToggle, onEdit, setView }: { tasks: ManagementTask[]; onToggle: (id: string) => void; onEdit: (task: ManagementTask) => void; setView: (v: View) => void }) {
  const ordered = [...tasks].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || a.date.localeCompare(b.date));
  const pending = tasks.filter((task) => task.status === "pending").length;
  const completed = tasks.length - pending;
  return <><PageTitle eyebrow="PLANEJAMENTO DA FAZENDA" title="Agenda de manejo" description="Acompanhe prazos, movimentações e atividades concluídas." action={<button className="primary big" onClick={() => setView("simulador")}>＋ Planejar remanejamento</button>} /><section className="agenda-summary"><span><small>PENDENTES</small><strong>{pending}</strong></span><span><small>CONCLUÍDAS</small><strong>{completed}</strong></span><span><small>PRÓXIMA ATIVIDADE</small><strong>{pending ? formatShortDate(ordered.find((task) => task.status === "pending")!.date) : "—"}</strong></span></section><section className="agenda-list">{ordered.length ? ordered.map((task) => <article className={`agenda-item ${task.status}`} key={task.id}><div className="agenda-date"><strong>{formatDay(task.date)}</strong><span>{formatMonth(task.date)}</span></div><div className="agenda-copy"><div><span className={`status ${task.type === "Pastagem" ? "good" : "warning"}`}>{task.type}</span><span className={`countdown ${daysUntil(task.date) < 0 ? "late" : ""}`}>{task.status === "completed" ? "Concluída" : countdownLabel(task.date)}</span></div><h2>{task.title}</h2><p>{task.details}</p></div><div className="task-actions"><button className="task-edit" onClick={() => onEdit(task)}>Editar</button><button className={task.status === "completed" ? "task-reopen" : "task-complete"} onClick={() => onToggle(task.id)}>{task.status === "completed" ? "Reabrir" : "Marcar como concluída"}</button></div></article>) : <div className="agenda-empty"><strong>Sua agenda está livre</strong><p>Crie uma simulação para planejar um novo remanejamento.</p><button onClick={() => setView("simulador")}>Abrir simulador</button></div>}</section></>;
}

function CompactTask({ task }: { task: ManagementTask }) { return <div className="task"><b>{formatDay(task.date)}</b><span>{formatMonth(task.date)}</span><div><strong>{task.title}</strong><small>{task.details}</small></div><em className={task.type === "Pastagem" ? "green" : ""}>{task.type}</em></div>; }

function parseDemoDate(date: string) { return new Date(`${date}T12:00:00`); }
function addDemoDays(days: number) { const date = parseDemoDate(DEMO_TODAY); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function daysUntil(date: string) { return Math.ceil((parseDemoDate(date).getTime() - parseDemoDate(DEMO_TODAY).getTime()) / 86400000); }
function formatDay(date: string) { return String(parseDemoDate(date).getDate()).padStart(2, "0"); }
function formatMonth(date: string) { return parseDemoDate(date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(); }
function formatShortDate(date: string) { return parseDemoDate(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); }
function countdownLabel(date: string) { const days = daysUntil(date); if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} em atraso`; if (days === 0) return "Hoje"; return `Faltam ${days} dia${days === 1 ? "" : "s"}`; }

function Rental({ setModal, notify }: { setModal: (v: "pasto") => void; notify: (v: string) => void }) { const listings = [{ name: "Fazenda Boa Esperança", city: "Rondonópolis · MT", area: 32, price: 58, distance: 46, level: 88 }, { name: "Sítio Campo Verde", city: "Jaciara · MT", area: 18, price: 45, distance: 72, level: 76 }]; return <><PageTitle eyebrow="REDE DE PASTAGENS" title="Disponibilidade e aluguel" description="Encontre áreas próximas ou disponibilize um pasto ocioso." action={<button className="primary big" onClick={() => setModal("pasto")}>＋ Anunciar pasto</button>} /><section className="rental-hero"><div><small>OPORTUNIDADE NA PROPRIEDADE</small><h2>O Piquete Sul pode gerar renda enquanto estiver disponível</h2><p>Cadastre o período livre, a capacidade estimada e as condições para receber solicitações de produtores próximos.</p><button onClick={() => setModal("pasto")}>Disponibilizar 20 hectares →</button></div><div className="rental-metric"><span>ÁREA LIVRE</span><strong>20 ha</strong><small>91% de disponibilidade</small></div></section><section className="section-row"><div><small>OPÇÕES PRÓXIMAS</small><h2>Pastos disponíveis para remanejamento</h2></div><button>Filtros: até 100 km⌄</button></section><section className="listing-grid">{listings.map((l) => <article className="listing" key={l.name}><div className="listing-visual"><div className="contours"><i /><i /><i /></div><span>{l.distance} km de distância</span></div><div className="listing-body"><span className="status good">Disponível agora</span><h3>{l.name}</h3><p>{l.city}</p><div><span><small>ÁREA</small><b>{l.area} ha</b></span><span><small>PASTO</small><b>{l.level}%</b></span><span><small>VALOR</small><b>R$ {l.price}/cab.</b></span></div><button onClick={() => notify(`Solicitação enviada para ${l.name}.`)}>Solicitar contato</button></div></article>)}</section></>; }

/* Modal backdrops intentionally handle pointer input while their forms stop propagation. */
/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */
function AnimalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: FormData) => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" action={onSubmit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>NOVO REGISTRO</small><h2>Cadastrar animal</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label>Brinco<input name="brinco" required placeholder="Ex.: BR-1120" /></label><label>Categoria<select name="categoria"><option>Vaca</option><option>Novilha</option><option>Garrote</option><option>Bezerro</option><option>Touro</option></select></label><label>Idade (meses)<input name="idade" type="number" required defaultValue="18" /></label><label>Peso (kg)<input name="peso" type="number" required defaultValue="280" /></label><label className="wide">Lote atual<select name="lote"><option>Lote A</option><option>Lote B</option><option>Lote C</option></select></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Cadastrar animal</button></div></form></div>; }
function ManagementModal({ onClose, onSubmit, suggestedDate, animals }: { onClose: () => void; onSubmit: (data: FormData) => void; suggestedDate: string; animals: number }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" action={onSubmit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>NOVO PLANEJAMENTO</small><h2>Agendar remanejamento</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></div><p className="modal-intro">Defina quando e para onde o lote será movimentado. O cenário atual considera {animals} animais.</p><div className="form-grid"><label>Lote<select name="lote" defaultValue="Lote A"><option>Lote A</option><option>Lote B</option><option>Lote C</option></select></label><label>Data planejada<input name="data" type="date" min={DEMO_TODAY} required defaultValue={suggestedDate} /></label><label>Origem<select name="origem" defaultValue="Piquete Norte">{pastureData.map((pasture) => <option key={pasture.name}>{pasture.name}</option>)}</select></label><label>Destino<select name="destino" defaultValue="Piquete Sul">{pastureData.map((pasture) => <option key={pasture.name}>{pasture.name}</option>)}</select></label></div><div className="schedule-preview"><span>DATA SUGERIDA PELO SIMULADOR</span><strong>{formatShortDate(suggestedDate)}</strong><small>Você pode ajustar antes de confirmar.</small></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Adicionar à agenda</button></div></form></div>; }
function EditTaskModal({ task, onClose, onSubmit }: { task: ManagementTask; onClose: () => void; onSubmit: (data: FormData) => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" action={onSubmit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>EDITAR ATIVIDADE</small><h2>Atualizar manejo</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></div><p className="modal-intro">Altere os dados necessários. O status atual será mantido.</p><div className="form-grid"><label className="wide">Nome da atividade<input name="titulo" required defaultValue={task.title} /></label><label>Categoria<select name="tipo" defaultValue={task.type}><option>Pastagem</option><option>Sanidade</option></select></label><label>Lote<select name="lote" defaultValue={task.lote}><option>Lote A</option><option>Lote B</option><option>Lote C</option></select></label><label>Data planejada<input name="data" type="date" required defaultValue={task.date} /></label><label className="wide">Detalhes<input name="detalhes" required defaultValue={task.details} /></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Salvar alterações</button></div></form></div>; }
function PastureModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>NOVO ANÚNCIO</small><h2>Disponibilizar pasto</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label className="wide">Área<select><option>Piquete Sul · 20 ha</option></select></label><label>Disponível a partir de<input type="date" required defaultValue="2026-08-25" /></label><label>Disponível até<input type="date" required defaultValue="2026-09-30" /></label><label>Capacidade estimada<input type="number" required defaultValue="40" /></label><label>Valor por cabeça/mês<input type="number" required defaultValue="55" /></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Publicar anúncio</button></div></form></div>; }
/* eslint-enable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */
