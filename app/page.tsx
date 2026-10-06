"use client";

import { useMemo, useState } from "react";

type View = "visao" | "rebanho" | "pastagens" | "simulador" | "aluguel";
type Animal = { id: string; brinco: string; categoria: string; idade: number; peso: number; lote: string };

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
  { id: "aluguel", label: "Aluguel", icon: "◇" },
];

export default function Home() {
  const [view, setView] = useState<View>("visao");
  const [animals, setAnimals] = useState(initialAnimals);
  const [modal, setModal] = useState<"animal" | "pasto" | null>(null);
  const [toast, setToast] = useState("");
  const [resolved, setResolved] = useState(false);
  const [search, setSearch] = useState("");
  const [sim, setSim] = useState({ animals: 48, area: 24, availability: 18, recovery: 28 });
  const [tour, setTour] = useState(0);

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
          {view === "visao" && <Overview animals={animals.length} resolved={resolved} setResolved={setResolved} setView={setView} notify={notify} setModal={setModal} />}
          {view === "rebanho" && <Herd animals={filteredAnimals} search={search} setSearch={setSearch} setModal={setModal} />}
          {view === "pastagens" && <Pastures resolved={resolved} setView={setView} />}
          {view === "simulador" && <Simulator sim={sim} setSim={setSim} result={simulation} notify={notify} />}
          {view === "aluguel" && <Rental setModal={setModal} notify={notify} />}
        </div>
      </section>

      {tour > 0 && <div className="tour-dock" role="status"><div><small>DEMONSTRAÇÃO · {tour}/4</small><strong>{["", "Comece pela situação da fazenda", "Mostre a condição de cada pasto", "Simule e explique a recomendação", "Finalize com o aluguel integrado"][tour]}</strong></div><div><button onClick={() => setTour(0)}>Sair</button><button className="primary" onClick={nextTour}>{tour === 4 ? "Concluir" : "Próximo"} →</button></div></div>}
      {modal === "animal" && <AnimalModal onClose={() => setModal(null)} onSubmit={addAnimal} />}
      {modal === "pasto" && <PastureModal onClose={() => setModal(null)} onSubmit={() => { setModal(null); notify("Pasto anunciado para aluguel."); }} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-title"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function Overview({ animals, resolved, setResolved, setView, notify, setModal }: { animals: number; resolved: boolean; setResolved: (v: boolean) => void; setView: (v: View) => void; notify: (v: string) => void; setModal: (v: "animal" | "pasto") => void }) {
  return <>
    <PageTitle eyebrow="QUINTA-FEIRA, 20 DE AGOSTO" title="Bom dia, Lucas." description="Aqui está o que exige atenção hoje na Fazenda Santa Luzia." action={<button className="primary big" onClick={() => setModal("animal")}>＋ Cadastrar animal</button>} />
    <section className="stat-grid"><Stat label="REBANHO TOTAL" value={String(182 + animals)} unit="animais" change="+6 este mês" icon="◉" /><Stat label="ÁREA MAPEADA" value="72" unit="hectares" detail="4 piquetes" icon="⌁" /><Stat label="PASTO DISPONÍVEL" value="1" unit="piquete" detail="20 ha livres" icon="▱" /><Stat label="ALERTAS ATIVOS" value={resolved ? "1" : "2"} unit="pendências" warning detail={resolved ? "1 tarefa sanitária" : "1 exige ação hoje"} icon="!" /></section>
    {!resolved ? <section className="critical-card"><div className="critical-icon">!</div><div className="critical-copy"><small>ALERTA DE PASTAGEM · ALTA PRIORIDADE</small><h2>Piquete Norte pode atingir o limite em 4 dias</h2><p>O lote com 48 animais consome o pasto mais rápido que a recuperação estimada. O Piquete Sul está disponível para remanejamento.</p><div className="recommendation"><span>RECOMENDAÇÃO</span><strong>Remanejar o Lote A até 24 de agosto</strong><small>Destino sugerido: Piquete Sul · 20 ha · 91% disponível</small></div></div><div className="critical-actions"><button className="primary" onClick={() => { setResolved(true); notify("Remanejamento registrado e alerta resolvido."); }}>Registrar remanejamento</button><button onClick={() => setView("simulador")}>Abrir simulação</button></div></section> : <section className="success-card"><span>✓</span><div><small>MANEJO REGISTRADO</small><h2>Lote A programado para o Piquete Sul</h2><p>O alerta foi resolvido. A movimentação está prevista para 24 de agosto.</p></div><button onClick={() => setResolved(false)}>Desfazer</button></section>}
    <section className="section-row"><div><small>VISÃO DAS PASTAGENS</small><h2>Condição atual dos piquetes</h2></div><button onClick={() => setView("pastagens")}>Ver todas as pastagens →</button></section>
    <section className="pasture-grid compact">{pastureData.map((p) => <PastureCard key={p.name} pasture={p} />)}</section>
    <section className="bottom-grid"><div className="panel"><div className="panel-head"><div><small>PRÓXIMAS ATIVIDADES</small><h2>Agenda de manejo</h2></div><button>Ver agenda</button></div><div className="task"><b>21</b><span>AGO</span><div><strong>Vacinação · Lote C</strong><small>22 bezerros · Curral principal</small></div><em>Sanidade</em></div><div className="task"><b>24</b><span>AGO</span><div><strong>Remanejamento · Lote A</strong><small>Piquete Norte → Piquete Sul</small></div><em className="green">Pastagem</em></div></div><div className="panel decision"><small>DECISÃO EM NÚMEROS</small><h2>4 dias</h2><p>até o limite estimado do Piquete Norte</p><div><span><b>48</b> animais</span><span><b>24 ha</b> de área</span><span><b>18%</b> disponível</span></div><button onClick={() => setView("simulador")}>Testar outro cenário →</button></div></section>
  </>;
}

function Stat({ label, value, unit, detail, change, warning, icon }: { label: string; value: string; unit: string; detail?: string; change?: string; warning?: boolean; icon: string }) { return <article className={`stat-card ${warning ? "warn" : ""}`}><div className="stat-icon">{icon}</div><small>{label}</small><div><strong>{value}</strong><span>{unit}</span></div>{change ? <em>↗ {change}</em> : <p>{detail}</p>}</article>; }
function PastureCard({ pasture }: { pasture: typeof pastureData[number] }) { return <article className="pasture-card"><div className="pasture-top"><span className={`status ${pasture.tone}`}>{pasture.status}</span><button aria-label={`Opções de ${pasture.name}`}>•••</button></div><h3>{pasture.name}</h3><p>{pasture.area} hectares · {pasture.animals ? `${pasture.animals} animais` : "sem animais"}</p><div className="level-label"><span>Disponibilidade estimada</span><b>{pasture.level}%</b></div><div className="progress"><i style={{ width: `${pasture.level}%` }} className={pasture.tone} /></div><small>{pasture.animals ? `${pasture.recovery} dias para recuperação` : "Pronto para receber um lote"}</small></article>; }

function Herd({ animals, search, setSearch, setModal }: { animals: Animal[]; search: string; setSearch: (v: string) => void; setModal: (v: "animal") => void }) { return <><PageTitle eyebrow="CONTROLE DO REBANHO" title="Animais e lotes" description="Acompanhe identificação, idade, peso e localização dos animais." action={<button className="primary big" onClick={() => setModal("animal")}>＋ Novo animal</button>} /><section className="summary-strip"><span><small>TOTAL DO REBANHO</small><strong>186</strong></span><span><small>PESO MÉDIO</small><strong>348 kg</strong></span><span><small>LOTES ATIVOS</small><strong>3</strong></span><span><small>GANHO MÉDIO</small><strong>0,72 kg/dia</strong></span></section><section className="panel table-panel"><div className="table-tools"><div><h2>Cadastro individual</h2><p>{animals.length} registros exibidos</p></div><label>⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar brinco, categoria ou lote" /></label></div><div className="data-table"><div className="table-row head"><span>BRINCO</span><span>CATEGORIA</span><span>IDADE</span><span>PESO</span><span>LOTE ATUAL</span><span>STATUS</span></div>{animals.map((a) => <div className="table-row" key={a.id}><span><b>{a.brinco}</b></span><span>{a.categoria}</span><span>{a.idade} meses</span><span>{a.peso} kg</span><span>{a.lote}</span><span><em className="status good">Ativo</em></span></div>)}</div></section></>; }

function Pastures({ resolved, setView }: { resolved: boolean; setView: (v: View) => void }) { return <><PageTitle eyebrow="GESTÃO DE PASTAGENS" title="Mapa de ocupação" description="Monitore uso, recuperação e capacidade de cada área." action={<button className="primary big" onClick={() => setView("simulador")}>↗ Nova simulação</button>} /><section className="pasture-map"><div className="map-head"><div><small>FAZENDA SANTA LUZIA</small><h2>72 hectares mapeados</h2></div><div className="legend"><span><i className="good" />Disponível</span><span><i className="active" />Em uso</span><span><i className="warning" />Atenção</span></div></div><div className="field-grid"><div className={`field north ${resolved ? "active" : "warning"}`}><small>24 HA</small><strong>PIQUETE NORTE</strong><span>{resolved ? "Remanejamento agendado" : "Limite em 4 dias"}</span></div><div className="field central active"><small>18 HA</small><strong>PIQUETE CENTRAL</strong><span>36 animais</span></div><div className="field south good"><small>20 HA</small><strong>PIQUETE SUL</strong><span>91% disponível</span></div><div className="field east active"><small>10 HA</small><strong>RESERVA LESTE</strong><span>22 animais</span></div></div></section><section className="section-row"><div><small>DETALHAMENTO</small><h2>Condição por piquete</h2></div></section><section className="pasture-grid">{pastureData.map((p) => <PastureCard key={p.name} pasture={p} />)}</section></>; }

function Simulator({ sim, setSim, result, notify }: { sim: { animals: number; area: number; availability: number; recovery: number }; setSim: (v: typeof sim) => void; result: { days: number }; notify: (v: string) => void }) { return <><PageTitle eyebrow="SIMULADOR DE PASTAGENS" title="Antecipe o próximo remanejamento" description="Teste cenários e entenda como a recomendação foi calculada." /><section className="sim-layout"><form className="sim-form" onSubmit={(e) => e.preventDefault()}><div className="form-head"><span>01</span><div><h2>Dados do cenário</h2><p>Ajuste os valores para atualizar o resultado.</p></div></div><label>Quantidade de animais<div><input type="number" min="1" value={sim.animals} onChange={(e) => setSim({ ...sim, animals: Number(e.target.value) })} /><span>animais</span></div></label><label>Área disponível<div><input type="number" min="1" value={sim.area} onChange={(e) => setSim({ ...sim, area: Number(e.target.value) })} /><span>hectares</span></div></label><label>Disponibilidade atual<div><input type="range" min="5" max="100" value={sim.availability} onChange={(e) => setSim({ ...sim, availability: Number(e.target.value) })} /><b>{sim.availability}%</b></div></label><label>Tempo de recuperação configurado<div><input type="number" min="1" value={sim.recovery} onChange={(e) => setSim({ ...sim, recovery: Number(e.target.value) })} /><span>dias</span></div></label><button className="secondary" type="button" onClick={() => setSim({ animals: 48, area: 24, availability: 18, recovery: 28 })}>Restaurar cenário do alerta</button></form><div className="sim-result"><div className="result-head"><span>RESULTADO ATUALIZADO</span><i>● ao vivo</i></div><div className="result-number"><strong>{result.days}</strong><span>dias</span></div><h2>até atingir o limite estimado</h2><p>Com {sim.animals} animais em {sim.area} hectares e {sim.availability}% de disponibilidade.</p><div className="formula"><small>COMO CHEGAMOS NISSO</small><p><b>Área × capacidade × disponibilidade</b><span>÷ quantidade de animais</span></p><code>({sim.area} × 8 × {sim.availability / 100}) ÷ {sim.animals} ≈ {result.days} dias</code></div><div className="result-alert"><span>!</span><div><strong>Recomendação</strong><p>Planeje o remanejamento em até <b>{result.days} dias</b>. O pasto precisará de aproximadamente {sim.recovery} dias de descanso.</p></div></div><button className="primary big full" onClick={() => notify("Cenário salvo no planejamento.")}>Salvar no planejamento</button></div></section><p className="disclaimer">Estimativa demonstrativa baseada nos dados cadastrados. A decisão final deve considerar avaliação de campo e orientação técnica.</p></>; }

function Rental({ setModal, notify }: { setModal: (v: "pasto") => void; notify: (v: string) => void }) { const listings = [{ name: "Fazenda Boa Esperança", city: "Rondonópolis · MT", area: 32, price: 58, distance: 46, level: 88 }, { name: "Sítio Campo Verde", city: "Jaciara · MT", area: 18, price: 45, distance: 72, level: 76 }]; return <><PageTitle eyebrow="REDE DE PASTAGENS" title="Disponibilidade e aluguel" description="Encontre áreas próximas ou disponibilize um pasto ocioso." action={<button className="primary big" onClick={() => setModal("pasto")}>＋ Anunciar pasto</button>} /><section className="rental-hero"><div><small>OPORTUNIDADE NA PROPRIEDADE</small><h2>O Piquete Sul pode gerar renda enquanto estiver disponível</h2><p>Cadastre o período livre, a capacidade estimada e as condições para receber solicitações de produtores próximos.</p><button onClick={() => setModal("pasto")}>Disponibilizar 20 hectares →</button></div><div className="rental-metric"><span>ÁREA LIVRE</span><strong>20 ha</strong><small>91% de disponibilidade</small></div></section><section className="section-row"><div><small>OPÇÕES PRÓXIMAS</small><h2>Pastos disponíveis para remanejamento</h2></div><button>Filtros: até 100 km⌄</button></section><section className="listing-grid">{listings.map((l) => <article className="listing" key={l.name}><div className="listing-visual"><div className="contours"><i /><i /><i /></div><span>{l.distance} km de distância</span></div><div className="listing-body"><span className="status good">Disponível agora</span><h3>{l.name}</h3><p>{l.city}</p><div><span><small>ÁREA</small><b>{l.area} ha</b></span><span><small>PASTO</small><b>{l.level}%</b></span><span><small>VALOR</small><b>R$ {l.price}/cab.</b></span></div><button onClick={() => notify(`Solicitação enviada para ${l.name}.`)}>Solicitar contato</button></div></article>)}</section></>; }

/* Modal backdrops intentionally handle pointer input while their forms stop propagation. */
/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */
function AnimalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: FormData) => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" action={onSubmit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>NOVO REGISTRO</small><h2>Cadastrar animal</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label>Brinco<input name="brinco" required placeholder="Ex.: BR-1120" /></label><label>Categoria<select name="categoria"><option>Vaca</option><option>Novilha</option><option>Garrote</option><option>Bezerro</option><option>Touro</option></select></label><label>Idade (meses)<input name="idade" type="number" required defaultValue="18" /></label><label>Peso (kg)<input name="peso" type="number" required defaultValue="280" /></label><label className="wide">Lote atual<select name="lote"><option>Lote A</option><option>Lote B</option><option>Lote C</option></select></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Cadastrar animal</button></div></form></div>; }
function PastureModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><small>NOVO ANÚNCIO</small><h2>Disponibilizar pasto</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label className="wide">Área<select><option>Piquete Sul · 20 ha</option></select></label><label>Disponível a partir de<input type="date" required defaultValue="2026-08-25" /></label><label>Disponível até<input type="date" required defaultValue="2026-09-30" /></label><label>Capacidade estimada<input type="number" required defaultValue="40" /></label><label>Valor por cabeça/mês<input type="number" required defaultValue="55" /></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Publicar anúncio</button></div></form></div>; }
/* eslint-enable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */
