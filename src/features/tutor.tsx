import { useState, type FormEvent } from "react";
import { getAccionesSugeridas, parsearFactoresRiesgo, registrarTutoria, useDataStore, type AccionTutoria, type DerivacionTutoria, type Estudiante, type Motivo, type RecalculoRiesgo } from "../data";
import { Button, HelpHint, Icon, PageHeading, RiskBadge, TrendIcon, calcularTendencia, formatearNivelPorcentaje, type IconName, type View } from "../components/common";
import { displayFactorFamily, getStudentReasons, getTopRecommendation } from "./recommendations";

export function Dashboard({
  navigate,
  openAlert,
  openSolution,
  showAlert,
  dismissAlert,
}: {
  navigate: (view: View) => void;
  openAlert: (idMatricula: string) => void;
  openSolution: (idMatricula: string) => void;
  showAlert: boolean;
  dismissAlert: () => void;
}) {
  const { estudiantes, modelo } = useDataStore();
  const riskCounts = {
    Bajo: estudiantes.filter((estudiante) => estudiante.riesgo.nivel === "Bajo").length,
    Medio: estudiantes.filter((estudiante) => estudiante.riesgo.nivel === "Medio").length,
    Alto: estudiantes.filter((estudiante) => estudiante.riesgo.nivel === "Alto").length,
  };
  const stats = [
    {
      label: "Total de estudiantes",
      value: estudiantes.length,
      variant: "blue",
      icon: "students" as IconName,
    },
    { label: "Riesgo bajo", value: riskCounts.Bajo, variant: "green", risk: "Bajo" as const },
    { label: "Riesgo medio", value: riskCounts.Medio, variant: "amber", risk: "Medio" as const },
    { label: "Riesgo alto", value: riskCounts.Alto, variant: "red", risk: "Alto" as const },
  ];
  const priorityStudents = estudiantes
    .filter((estudiante) => estudiante.riesgo.nivel !== "Bajo")
    .sort((a, b) => {
      const levelOrder = { Alto: 0, Medio: 1, Bajo: 2 };
      const levelDifference = levelOrder[a.riesgo.nivel] - levelOrder[b.riesgo.nivel];
      return levelDifference || b.riesgo.probabilidad - a.riesgo.probabilidad;
    });
  const priorityStudent = priorityStudents[0];
  const pendingTeacherDerivations = estudiantes.reduce(
    (total, estudiante) =>
      total +
      estudiante.derivaciones.filter((derivacion) => derivacion.estado === "Pendiente").length,
    0,
  );
  const recommendedCounts = priorityStudents.reduce<Record<string, number>>((counts, student) => {
    const recommendation = getTopRecommendation(student);
    if (recommendation) counts[recommendation.nombre] = (counts[recommendation.nombre] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
      {showAlert && priorityStudent && (
        <section className="automatic-alert" role="status">
          <span className="automatic-alert-icon"><Icon name="alerts" /></span>
          <p>
            <strong>Sugerencia de apoyo:</strong> {priorityStudent.alumno.nombre} se encuentra en
            nivel {priorityStudent.riesgo.nivel.toLowerCase()} y registra{" "}
            {priorityStudent.alumno.inasistencias}{" "}
            {priorityStudent.alumno.inasistencias === 1 ? "inasistencia" : "inasistencias"}.
            Requiere revisión del tutor.
          </p>
          <Button onClick={() => openAlert(priorityStudent.alumno.id_matricula)}>Ver alerta</Button>
          <button type="button" className="alert-dismiss" onClick={dismissAlert} aria-label="Descartar aviso"><Icon name="close" size={18} /></button>
        </section>
      )}
      <PageHeading title="Dashboard" subtitle="Resumen del estado académico de los estudiantes" />
      <section className="stats-grid" aria-label="Indicadores generales">
        {stats.map((stat) => (
          <article className={`stat-card stat-${stat.variant}`} key={stat.label}>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              {stat.risk ? <RiskBadge level={stat.risk as "Bajo" | "Medio" | "Alto"} /> : <span className="stat-context">Matrícula actual</span>}
            </div>
            <div className="stat-icon">
              {stat.icon ? <Icon name={stat.icon} size={22} /> : <span className="large-dot" />}
            </div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="card table-card">
          <div className="card-header">
            <div>
              <h2>Estudiantes que requieren atención</h2>
              <p>Priorizados según rendimiento académico y asistencia.</p>
            </div>
            <span className="update-chip">Actualizado hoy</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Rendimiento (tendencia)</th>
                  <th>Asistencia</th>
                  <th>Nivel de riesgo (%) <HelpHint text="Qué tan probable es que el estudiante termine el año con dificultades." /></th>
                  <th>Acción recomendada</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {priorityStudents.map((student) => {
                  const performance = calcularTendencia(
                    student.alumno.promedios_bimestre.B1,
                    student.alumno.promedios_bimestre.B2,
                  );
                  const absences = student.alumno.inasistencias;

                  return (
                  <tr key={student.alumno.id_matricula}>
                    <td>
                      <div className="student-cell">
                        <span className="student-avatar">{student.alumno.nombre.split(" ").map((part) => part[0]).join("")}</span>
                        <div><strong>{student.alumno.nombre}</strong><span>3.º Sec. · A</span></div>
                      </div>
                    </td>
                    <td><span className={performance.includes("descenso") || performance === "Descendente" ? "down-text" : "trend-neutral"}><TrendIcon trend={performance} />{performance}</span></td>
                    <td>{absences} {absences === 1 ? "inasistencia" : "inasistencias"}</td>
                    <td>
                      <div className="probability-cell">
                        <strong>{formatearNivelPorcentaje(student.riesgo.probabilidad)}</strong>
                        <RiskBadge level={student.riesgo.nivel} />
                      </div>
                    </td>
                    <td>
                      {getTopRecommendation(student) ? (
                        <div className="recommended-table-cell">
                          <strong>{getTopRecommendation(student)?.nombre}</strong>
                          <Button secondary onClick={() => openSolution(student.alumno.id_matricula)}>Ver solución</Button>
                        </div>
                      ) : "Por revisar"}
                    </td>
                    <td><Button onClick={() => openAlert(student.alumno.id_matricula)}>Ver alerta</Button></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
        <aside className="card alerts-summary">
          <div className="card-header">
            <div><h2>Resumen de alertas</h2><p>Vista rápida de prioridades</p></div>
          </div>
          <div className="summary-list">
            <div className="summary-row"><span className="summary-icon high"><Icon name="alerts" /></span><div><strong>{riskCounts.Alto}</strong><RiskBadge level="Alto" /></div><Icon name="chevron" size={17} /></div>
            <div className="summary-row"><span className="summary-icon medium"><Icon name="alerts" /></span><div><strong>{riskCounts.Medio}</strong><RiskBadge level="Medio" /></div><Icon name="chevron" size={17} /></div>
            <button type="button" className="summary-row summary-link" onClick={() => navigate("derivations")}>
              <span className="summary-icon blue"><Icon name="send" /></span>
              <div><strong>{pendingTeacherDerivations}</strong><span>Derivaciones de docentes pendientes</span></div>
              <Icon name="chevron" size={17} />
            </button>
          </div>
          <div className="summary-foot">
            <span><Icon name="info" size={17} /> Revisión sugerida</span>
            <p>Prioriza las alertas recientes y contrasta cada señal antes de definir acciones.</p>
            <p className="automatic-rule">Los conteos se actualizan con las evidencias integradas en el sistema.</p>
          </div>
        </aside>
      </section>
      <section className="card recommended-summary">
        <div className="card-header"><div><p className="section-label">Soluciones</p><h2>Acciones más recomendadas este bimestre</h2></div></div>
        <div className="recommended-summary-list">
          {Object.entries(recommendedCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
            <div key={action}><strong>{action}</strong><span>{count} {count === 1 ? "estudiante" : "estudiantes"}</span></div>
          ))}
        </div>
      </section>
      <section className="card model-explainer">
        <div className="model-intro">
          <p className="section-label">Transparencia del sistema</p>
          <h2>Cómo se genera la alerta</h2>
          <p>La información orienta la revisión; la decisión final es del tutor.</p>
        </div>
        <div className="model-flow">
          <div><span><Icon name="students" /></span><strong>El docente registra notas, asistencia y conducta</strong><small>Información del aula</small></div>
          <Icon name="chevron" />
          <div><span><Icon name="calendar" /></span><strong>El sistema reúne la información</strong><small>Datos organizados</small></div>
          <Icon name="chevron" />
          <div><span><Icon name="model" /></span><strong>Se calcula el nivel de riesgo</strong><small>Comparación con casos anteriores</small></div>
          <Icon name="chevron" />
          <div><span><Icon name="alerts" /></span><strong>El tutor revisa y decide</strong><small>Decisión profesional</small></div>
        </div>
        <p className="roadmap-note">
          Riesgo medio: desde {(modelo.umbrales.medio * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} % · Riesgo alto: desde {(modelo.umbrales.alto * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %
        </p>
      </section>
    </>
  );
}

export function Students({
  openAlert,
  openHistory,
  openSolution,
}: {
  openAlert: (idMatricula: string) => void;
  openHistory: (idMatricula: string) => void;
  openSolution: (idMatricula: string) => void;
}) {
  const { estudiantes } = useDataStore();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("Todos");
  const filtered = estudiantes
    .filter(
      (student) =>
        student.alumno.nombre.toLowerCase().includes(query.toLowerCase()) &&
        (risk === "Todos" || student.riesgo.nivel === risk),
    )
    .sort((a, b) => b.riesgo.probabilidad - a.riesgo.probabilidad);

  return (
    <>
      <PageHeading title="Estudiantes" subtitle="Listado de la sección 3.º de Secundaria – A" />
      <section className="card student-directory">
        <div className="directory-toolbar">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar estudiante por nombre"
            />
          </label>
          <label className="filter-box">
            <Icon name="filter" size={17} />
            <span>Nivel de riesgo</span>
            <select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filtrar por nivel de riesgo">
              <option>Todos</option>
              <option>Bajo</option>
              <option>Medio</option>
              <option>Alto</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Estudiante</th><th>Código</th><th title="Promedio del Bimestre 1 al Bimestre 2">Promedio Bim. 1 → Bim. 2</th><th>Inasistencias</th><th>Tendencia</th><th>Nivel de riesgo (%) <HelpHint text="Qué tan probable es que el estudiante termine el año con dificultades." /></th><th>Nivel</th><th>Acción recomendada</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.alumno.id_matricula}>
                  <td><div className="student-cell"><span className="student-avatar">{student.alumno.nombre.split(" ").map((part) => part[0]).join("")}</span><div><strong>{student.alumno.nombre}</strong><span>3.º Sec. · A</span></div></div></td>
                  <td>{student.alumno.codigo}</td>
                  <td><strong className="average-value">{student.alumno.promedios_bimestre.B1} → {student.alumno.promedios_bimestre.B2}</strong></td>
                  <td>{student.alumno.inasistencias}</td>
                  <td>
                    {(() => {
                      const trend = calcularTendencia(
                        student.alumno.promedios_bimestre.B1,
                        student.alumno.promedios_bimestre.B2,
                      );
                      return <span className={trend.toLowerCase().includes("descenso") || trend === "Descendente" ? "down-text" : "trend-neutral"}><TrendIcon trend={trend} />{trend}</span>;
                    })()}
                  </td>
                  <td><strong className="probability-value">{formatearNivelPorcentaje(student.riesgo.probabilidad)}</strong></td>
                  <td><RiskBadge level={student.riesgo.nivel} /></td>
                  <td>
                    {getTopRecommendation(student) ? (
                      <button type="button" className="solution-link" onClick={() => openSolution(student.alumno.id_matricula)}>
                        {getTopRecommendation(student)?.nombre}
                      </button>
                    ) : "Por revisar"}
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button onClick={() => openAlert(student.alumno.id_matricula)}>Ver alerta</Button>
                      <Button secondary onClick={() => openHistory(student.alumno.id_matricula)}>Ver seguimiento</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="directory-footer">
          <p><Icon name="info" size={17} /> Vista de consulta. El nivel de riesgo es un apoyo para la revisión del tutor, no una etiqueta.</p>
          <strong>{filtered.length} estudiantes</strong>
        </div>
      </section>
    </>
  );
}

function StudentBanner({ student }: { student: Estudiante }) {
  const initials = student.alumno.nombre
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="student-banner">
      <div className="student-big-avatar">{initials}</div>
      <div>
        <p>Estudiante</p>
        <h2>{student.alumno.nombre}</h2>
        <span>3.º de Secundaria – A · Código {student.alumno.codigo}</span>
      </div>
      <div className="banner-risk">
        <span>Nivel actual</span>
        <RiskBadge level={student.riesgo.nivel} />
      </div>
    </div>
  );
}

function SuggestedActions({
  student,
  readOnly,
  tutorName,
}: {
  student: Estudiante;
  readOnly: boolean;
  tutorName: string;
}) {
  const [selectedPattern, setSelectedPattern] = useState<{
    reason: Motivo;
    action: AccionTutoria;
  } | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [destination, setDestination] = useState<DerivacionTutoria>("Ninguna");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const visibleProfiles = getStudentReasons(student);
  const [activeProfile, setActiveProfile] = useState(visibleProfiles[0]);

  const saveSuggestedAction = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPattern) return;
    registrarTutoria(student.alumno.id_matricula, {
      fecha: date,
      motivo: selectedPattern.reason,
      accion: selectedPattern.action,
      derivacion: destination,
      mejoro_sim: false,
      nota: note.trim() || undefined,
      tutor: tutorName,
    });
    setConfirmation("El seguimiento fue registrado y ya aparece en el historial del estudiante.");
    setSelectedPattern(null);
  };

  return (
    <article className="card suggested-actions solution-feature" id="solucion-recomendada">
      <p className="section-label">Solución recomendada</p>
      <h2>Para {student.alumno.nombre}, con motivo principal: {visibleProfiles[0] ?? "Por revisar"}</h2>
      <p className="patterns-warning">Sugerencia basada en casos similares del colegio (datos de demostración). Es una guía, no una garantía; el tutor decide.</p>

      {visibleProfiles.length > 1 && (
        <div className="solution-tabs" role="tablist">
          {visibleProfiles.map((profile, index) => (
            <button type="button" role="tab" aria-selected={activeProfile === profile} className={activeProfile === profile ? "active" : ""} onClick={() => setActiveProfile(profile)} key={profile}>
              {index === 0 ? "Motivo principal" : "Motivo secundario"}: {profile}
            </button>
          ))}
        </div>
      )}

      {activeProfile ? (() => {
        const actions = getAccionesSugeridas(activeProfile, student.tutorias);
        const recommended = actions.find((action) => action.aplicaciones.length === 0) ?? actions[0];
        const alternatives = actions.filter((action) => action.nombre !== recommended?.nombre);
        if (!recommended) return <p className="insufficient-patterns">Aún no hay suficiente información para sugerir una acción en este motivo.</p>;
        return (
          <section className="pattern-profile">
            <div className="recommended-action">
              <span className="recommended-chip">Recomendada</span>
              <small>Acción recomendada</small>
              <strong>{recommended.nombre}</strong>
              <p>En casos similares, esta acción ayudó a mejorar el promedio en el {recommended.pct_mejoro} % de los casos ({recommended.n_casos} casos).</p>
              {recommended.aplicaciones.map((tutoring, index) => (
                <div className="previous-action" key={`${tutoring.fecha}-${index}`}>
                  <Icon name="check" size={14} /> Ya aplicada el {tutoring.fecha} · Resultado: {tutoring.mejoro_sim ? "Mejoró" : "No mejoró"}
                </div>
              ))}
              {!readOnly && <Button onClick={() => setSelectedPattern({ reason: activeProfile, action: recommended.nombre })}>Aplicar esta acción</Button>}
            </div>
            {alternatives.length > 0 && <h3>Otras opciones</h3>}
            {alternatives.map((action) => (
              <div className="pattern-action" key={action.nombre}>
                  <div className="pattern-action-heading">
                    <strong>{action.nombre}</strong>
                    <span>{action.pct_mejoro} %</span>
                  </div>
                  <div className="pattern-bar" aria-label={`${action.pct_mejoro} % de casos con mejora`}>
                    <span style={{ width: `${action.pct_mejoro}%` }} />
                  </div>
                  <div className="pattern-metrics">
                    <span>{action.n_casos} casos</span>
                    <span>{action.variacion_media > 0 ? "+" : ""}{action.variacion_media} puntos de promedio</span>
                  </div>
                  {action.aplicaciones.map((tutoring, index) => (
                    <div className="previous-action" key={`${tutoring.fecha}-${index}`}>
                      <Icon name="check" size={14} />
                      Ya aplicada el {tutoring.fecha} · Resultado: {tutoring.mejoro_sim ? "Mejoró" : "No mejoró"}
                    </div>
                  ))}
                  {!readOnly && <Button
                    secondary
                    onClick={() => {
                      setSelectedPattern({ reason: activeProfile, action: action.nombre });
                      setConfirmation("");
                    }}
                  >
                    Elegir otra acción
                  </Button>}
                </div>
            ))}
          </section>
        );
      })() : <p className="insufficient-patterns">Aún no hay suficiente información para sugerir una acción en este motivo.</p>}

      {confirmation && <div className="pattern-confirmation" role="status"><Icon name="check" size={16} />{confirmation}</div>}
      <section className="patterns-explainer">
        <h3>¿De dónde sale esta sugerencia?</h3>
        <p>Se agrupan las tutorías por motivo y acción y se calcula en qué proporción mejoró el promedio en el bimestre siguiente.</p>
      </section>

      {selectedPattern && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedPattern(null)}>
          <form className="followup-modal pattern-form" onSubmit={saveSuggestedAction} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-label">Registrar seguimiento</p><h2>Aplicar acción sugerida</h2></div>
              <button type="button" className="modal-close" onClick={() => setSelectedPattern(null)} aria-label="Cerrar formulario"><Icon name="close" /></button>
            </div>
            <label className="form-field"><span>Motivo</span><input value={selectedPattern.reason} readOnly /></label>
            <label className="form-field"><span>Acción</span><input value={selectedPattern.action} readOnly /></label>
            <label className="form-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="form-field"><span>Derivación</span><select value={destination} onChange={(event) => setDestination(event.target.value as DerivacionTutoria)}><option value="Ninguna">Ninguna</option><option value="Psicologia">Psicología</option><option value="Coordinacion">Coordinación</option></select></label>
            <label className="form-field"><span>Nota opcional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Acuerdos o aspectos por continuar." /></label>
            <div className="modal-actions"><Button secondary onClick={() => setSelectedPattern(null)}>Cancelar</Button><Button type="submit">Guardar seguimiento</Button></div>
          </form>
        </div>
      )}
    </article>
  );
}

export function AlertDetail({
  student,
  navigate,
  openFollowUp,
  canCommunicate,
  canApply,
  tutorName,
}: {
  student: Estudiante;
  navigate: (view: View) => void;
  openFollowUp: () => void;
  canCommunicate: boolean;
  canApply: boolean;
  tutorName: string;
}) {
  const { modelo } = useDataStore();
  const probabilityPercent = student.riesgo.probabilidad * 100;
  const factors = parsearFactoresRiesgo(student.riesgo.factores);
  const maxFactorValue = Math.max(...factors.map((factor) => Math.abs(factor.valor)), 0.01);
  const averageChange =
    student.alumno.promedios_bimestre.B2 - student.alumno.promedios_bimestre.B1;
  const relevantObservations = student.observaciones_conducta.filter(
    (observation) =>
      observation.tipo === "Grave" || observation.tipo === "Socioemocional",
  ).length;

  return (
    <>
      <PageHeading
        eyebrow="Caso priorizado"
        title="Detalle de alerta académica"
        subtitle="Revisa las señales detectadas antes de definir una acción de acompañamiento."
        onBack={() => navigate("dashboard")}
      />
      <StudentBanner student={student} />
      <section className="alert-layout">
        <div className="alert-main">
          <article className="card risk-overview">
            <div className="risk-heading">
              <div><p className="section-label">Evaluación integrada</p><h2>Señales compatibles con riesgo {student.riesgo.nivel.toLowerCase()} <HelpHint text="El porcentaje indica qué tan probable es que el estudiante termine el año con dificultades." /></h2></div>
              <RiskBadge level={student.riesgo.nivel} />
            </div>
            <div className="risk-meter" aria-label={`Nivel de riesgo: ${formatearNivelPorcentaje(student.riesgo.probabilidad)}`}>
              <div
                className="risk-meter-track"
                style={{
                  background: `linear-gradient(90deg, var(--low) 0 ${modelo.umbrales.medio * 100}%, var(--medium) ${modelo.umbrales.medio * 100}% ${modelo.umbrales.alto * 100}%, var(--high) ${modelo.umbrales.alto * 100}% 100%)`,
                }}
              >
                <span className="risk-threshold threshold-medium" style={{ left: `${modelo.umbrales.medio * 100}%` }} />
                <span className="risk-threshold-label label-medium" style={{ left: `${modelo.umbrales.medio * 100}%` }}>{(modelo.umbrales.medio * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %</span>
                <span className="risk-threshold threshold-high" style={{ left: `${modelo.umbrales.alto * 100}%` }} />
                <span className="risk-threshold-label label-high" style={{ left: `${modelo.umbrales.alto * 100}%` }}>{(modelo.umbrales.alto * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %</span>
                <span
                  className="risk-indicator"
                  style={{ left: `${Math.min(99, Math.max(1, probabilityPercent))}%` }}
                >
                  <strong>{formatearNivelPorcentaje(student.riesgo.probabilidad)}</strong>
                </span>
              </div>
              <div className="risk-meter-labels"><span>Bajo</span><span>Medio</span><span>Alto</span></div>
            </div>
          </article>
          <article className="card model-estimate">
            <span className="estimate-icon"><Icon name="model" /></span>
            <div>
              <p className="section-label">Cálculo de la alerta</p>
              <h2>Cómo se calculó esta alerta</h2>
              <p>El sistema revisó las notas y la asistencia del Bimestre 1 y 2, la conducta, las tutorías y la situación del estudiante, y las comparó con casos anteriores del colegio. Es un apoyo: la decisión es del tutor.</p>
            </div>
            <RiskBadge level={student.riesgo.nivel} />
          </article>
          <article className="card signals-card">
            <div className="card-header"><div><h2>Señales detectadas</h2><p>Indicadores que requieren la revisión del tutor.</p></div></div>
            <div className="signals-list dynamic-signals">
              <div className="signal-item">
                <span><Icon name={averageChange < 0 ? "trendDown" : averageChange > 0 ? "trendUp" : "trendFlat"} /></span>
                <div>
                  <strong>Promedio Bimestre 1 → Bimestre 2</strong>
                  <p>
                    {student.alumno.promedios_bimestre.B1} → {student.alumno.promedios_bimestre.B2}
                    {averageChange < 0
                      ? ` · caída de ${Math.abs(averageChange)} ${Math.abs(averageChange) === 1 ? "punto" : "puntos"}`
                      : averageChange > 0
                        ? ` · aumento de ${averageChange} ${averageChange === 1 ? "punto" : "puntos"}`
                        : " · sin variación"}
                  </p>
                </div>
              </div>
              <div className="signal-item">
                <span><Icon name="calendar" /></span>
                <div><strong>Inasistencias</strong><p>{student.alumno.inasistencias} registradas en el periodo.</p></div>
              </div>
              <div className="signal-item">
                <span><Icon name="alerts" /></span>
                <div><strong>Observaciones relevantes</strong><p>{relevantObservations} {relevantObservations === 1 ? "observación" : "observaciones"} de tipo Grave o Socioemocional.</p></div>
              </div>
              <div className="signal-item">
                <span><Icon name="history" /></span>
                <div><strong>Tutorías previas</strong><p>{student.tutorias.length} {student.tutorias.length === 1 ? "registrada" : "registradas"}.</p></div>
              </div>
              <div className="signal-item derivation-signal">
                <span><Icon name="send" /></span>
                <div>
                  <strong>Derivaciones del docente</strong>
                  {student.derivaciones.length > 0 ? student.derivaciones.map((derivacion) => (
                    <p key={derivacion.id}>
                      {derivacion.docente} · {derivacion.fecha} · {derivacion.motivo} · {derivacion.estado}
                    </p>
                  )) : <p>Sin derivaciones registradas.</p>}
                </div>
              </div>
            </div>
          </article>
          <div className="human-note">
            <Icon name="info" />
            <p><strong>Revisión humana necesaria.</strong> Esta alerta es un apoyo para la revisión del tutor. No constituye una sanción ni un diagnóstico definitivo. Toda decisión requiere revisión humana.</p>
          </div>
        </div>
        <aside className="alert-side">
          <article className="card metrics-card">
            <h2>Indicadores actuales</h2>
            <div className="metric-grid">
              <div><span>Promedio Bimestre 2</span><strong>{student.alumno.promedios_bimestre.B2}</strong><small>de 20</small></div>
              <div><span>Promedio Bimestre 1</span><strong>{student.alumno.promedios_bimestre.B1}</strong><small>de 20</small></div>
              <div><span>Inasistencias</span><strong>{student.alumno.inasistencias}</strong><small>este periodo</small></div>
              <div><span>Tendencia</span><strong className="trend-value"><TrendIcon trend={calcularTendencia(student.alumno.promedios_bimestre.B1, student.alumno.promedios_bimestre.B2)} />{calcularTendencia(student.alumno.promedios_bimestre.B1, student.alumno.promedios_bimestre.B2)}</strong></div>
            </div>
          </article>
          <article className="card factors-card">
            <h2>¿Por qué se generó esta alerta?</h2>
            <p>Información que tuvo mayor influencia en el semáforo.</p>
            <div className="factor-list">
              {factors.map((factor) => (
                <div className="factor-row" key={factor.familia}>
                  <div className="factor-copy">
                    <strong>{displayFactorFamily(factor.familia)}</strong>
                    <span>Peso en la alerta: {Math.abs(factor.valor) / maxFactorValue >= 0.67 ? "Alto" : Math.abs(factor.valor) / maxFactorValue >= 0.34 ? "Medio" : "Bajo"}</span>
                  </div>
                  <div className="factor-bar" aria-hidden="true">
                    <span style={{ width: `${(Math.abs(factor.valor) / maxFactorValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <SuggestedActions student={student} readOnly={!canApply} tutorName={tutorName} />
        </aside>
      </section>
      <p className="alert-detail-footer">El nivel de riesgo es una estimación de apoyo; la decisión es del tutor.</p>
      <div className="action-bar">
        <p><Icon name="info" size={17} /> Selecciona una acción para continuar con el acompañamiento.</p>
        <div>
          {canCommunicate && <Button secondary onClick={() => navigate("communication")}>Comunicar a la familia</Button>}
          {canApply && <Button secondary onClick={openFollowUp}>Registrar seguimiento</Button>}
          <Button onClick={() => navigate("history")}>Ver historial</Button>
        </div>
      </div>
    </>
  );
}

function PerformanceChart({ student }: { student: Estudiante }) {
  const sessionGrades = student.calificaciones ?? [];
  const currentAverage =
    sessionGrades.length > 0
      ? sessionGrades.reduce((total, grade) => total + grade.nota, 0) / sessionGrades.length
      : null;
  const points = [
    { label: "Bimestre 1", value: student.alumno.promedios_bimestre.B1 },
    { label: "Bimestre 2", value: student.alumno.promedios_bimestre.B2 },
    ...(currentAverage === null ? [] : [{ label: "Actual (en curso)", value: currentAverage }]),
  ];
  const xPositions = points.length === 2 ? [85, 515] : [60, 300, 540];
  const chartPoints = points.map((point, index) => ({
    ...point,
    x: xPositions[index],
    y: 175 - point.value * 7.5,
  }));
  const path = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="chart-wrap performance-chart" aria-label={`Rendimiento de ${student.alumno.nombre}`}>
      <div className="chart-y">{[20, 15, 10, 5, 0].map((value) => <span key={value}>{value}</span>)}</div>
      <svg viewBox="0 0 600 220" role="img">
        <title>Promedios de Bimestre 1, Bimestre 2{currentAverage === null ? "" : " y Actual en curso"}</title>
        {[20, 15, 10, 5, 0].map((value) => {
          const y = 175 - value * 7.5;
          return <line key={value} x1="25" x2="575" y1={y} y2={y} className="grid-line" />;
        })}
        <polyline points={path} className="area-line" />
        {chartPoints.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="6" className="chart-point" />
            <text x={point.x} y={point.y - 15} textAnchor="middle" className="chart-value">
              {point.value.toLocaleString("es-PE", { maximumFractionDigits: 1 })}
            </text>
            <text x={point.x} y="207" textAnchor="middle" className="axis-label">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function History({
  student,
  riskHistory,
  navigate,
  openFollowUp,
  canCommunicate,
}: {
  student: Estudiante;
  riskHistory: RecalculoRiesgo[];
  navigate: (view: View) => void;
  openFollowUp: () => void;
  canCommunicate: boolean;
}) {
  const averageChange =
    student.alumno.promedios_bimestre.B2 - student.alumno.promedios_bimestre.B1;
  const socioemotionalSignals = student.observaciones_conducta.filter(
    (observation) => observation.tipo === "Socioemocional",
  ).length;
  const reading = [
    averageChange < 0
      ? `Se observa un descenso de ${Math.abs(averageChange)} ${Math.abs(averageChange) === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.`
      : averageChange > 0
        ? `Se observa un aumento de ${averageChange} ${averageChange === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.`
        : "El promedio se mantiene entre el Bimestre 1 y el Bimestre 2.",
    student.alumno.inasistencias > 0
      ? `Se registran ${student.alumno.inasistencias} inasistencias en el periodo.`
      : "No se registran inasistencias en el periodo.",
    socioemotionalSignals > 0
      ? `Se registran ${socioemotionalSignals} ${socioemotionalSignals === 1 ? "señal socioemocional" : "señales socioemocionales"} para revisión.`
      : "No se registran observaciones socioemocionales.",
    "Estos indicadores no determinan una causa; sirven como apoyo para la revisión del tutor.",
  ].join(" ");
  const supportEvents: { date: string; type: string; title: string; details: string }[] = [
    ...student.tutorias.map((tutoria) => ({
      date: tutoria.fecha,
      type: "Tutoría",
      title: tutoria.motivo,
      details: `${tutoria.accion} · Derivación: ${tutoria.derivacion} · ${tutoria.mejoro_sim ? "Mejoró" : "No mejoró"}${tutoria.tutor ? ` · Tutor: ${tutoria.tutor}` : ""}${tutoria.nota ? ` · ${tutoria.nota}` : ""}`,
    })),
    ...student.observaciones_conducta.map((observation) => ({
      date: observation.fecha,
      type: "Observación de conducta",
      title: observation.tipo,
      details: observation.deriva_a_tutor ? "Derivada al tutor" : "Sin derivación al tutor",
    })),
    ...student.derivaciones.map((derivation) => ({
      date: derivation.fecha,
      type: "Derivación docente",
      title: derivation.motivo,
      details: `${derivation.docente} · ${derivation.estado} · ${derivation.accion_tutor}${derivation.tutor ? ` · Tutor: ${derivation.tutor}` : ""}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeading
        eyebrow="Historial académico"
        title="Seguimiento del estudiante"
        subtitle="Analiza la evolución de los indicadores para orientar el acompañamiento."
        onBack={() => navigate("alert")}
      />
      <StudentBanner student={student} />
      <section className="history-grid">
        <article className="card chart-card wide">
          <div className="card-header">
            <div><p className="section-label">Rendimiento académico</p><h2>Promedio del Bimestre 1 al Bimestre 2</h2><span>{averageChange < 0 ? `El promedio bajó ${Math.abs(averageChange)} ${Math.abs(averageChange) === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.` : averageChange > 0 ? `El promedio subió ${averageChange} ${averageChange === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.` : "El promedio se mantuvo entre ambos bimestres."}</span></div>
            <span className="trend-chip"><TrendIcon trend={calcularTendencia(student.alumno.promedios_bimestre.B1, student.alumno.promedios_bimestre.B2)} /> {calcularTendencia(student.alumno.promedios_bimestre.B1, student.alumno.promedios_bimestre.B2)}</span>
          </div>
          <PerformanceChart student={student} />
          <div className="course-table">
            <div className="card-header"><div><h2>Promedio por curso</h2><p>Escala de 0 a 20. Menos de 11 se considera desaprobado.</p></div></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Curso</th><th title="Bimestre 1">Bim. 1</th><th title="Bimestre 2">Bim. 2</th></tr></thead>
                <tbody>
                  {student.notas_por_curso.map((course) => (
                    <tr key={course.curso}>
                      <td><strong>{course.curso}</strong></td>
                      <td className={course.B1 < 11 ? "failing-grade" : ""}>{course.B1}</td>
                      <td className={course.B2 < 11 ? "failing-grade" : ""}>{course.B2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
        <article className="card attendance-log">
          <div className="card-header">
            <div>
              <p className="section-label">Asistencia</p>
              <h2>Registro de asistencia reciente</h2>
              <span>Total de inasistencias: {student.alumno.inasistencias}</span>
            </div>
            <span className="access-note"><Icon name="info" size={15} /> Vista disponible solo para tutor y coordinación.</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Ingreso</th><th>Estado</th><th>Medio</th></tr></thead>
              <tbody>
                {student.asistencia_reciente.map((attendance) => (
                  <tr key={attendance.fecha}>
                    <td>{attendance.fecha}</td>
                    <td>{attendance.hora_ingreso ?? "—"}</td>
                    <td>
                      <span className={`attendance-status attendance-${attendance.estado.toLowerCase().replace(/\s+/g, "-")}`}>
                        <Icon name={attendance.estado === "Presente" ? "check" : "info"} size={14} />
                        {attendance.estado}
                      </span>
                    </td>
                    <td>{attendance.medio === "Lector IoT" ? "Lector de ingreso" : attendance.medio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card risk-history-card">
          <div className="card-header"><div><p className="section-label">Nivel de riesgo</p><h2>Evolución del riesgo</h2><span>Nivel inicial y actualizaciones con nueva información.</span></div></div>
          <div className="risk-history-list">
            <div className="risk-history-item">
              <span className="timeline-bullet" />
              <div><strong>Nivel inicial</strong><small>Información de los Bimestres 1 y 2</small></div>
              <span className="risk-probability">{formatearNivelPorcentaje(student.riesgo.probabilidad)}</span>
              <RiskBadge level={student.riesgo.nivel} />
            </div>
            {riskHistory.map((entry, index) => (
              <div className="risk-history-item" key={`${entry.fecha}-${index}`}>
                <span className="timeline-bullet" />
                <div><strong>Nivel actualizado con la nueva evidencia</strong><small>{entry.fecha}</small></div>
                <span className="risk-probability">{formatearNivelPorcentaje(entry.probabilidad)}</span>
                <RiskBadge level={entry.nivel} />
              </div>
            ))}
          </div>
        </article>
        <article className="evolution-summary">
          <div className="summary-mark"><Icon name="trend" /></div>
          <div><p className="section-label">Lectura orientativa</p><h2>Resumen de evolución</h2><p>{reading}</p></div>
        </article>
        <article className="card support-timeline-card">
          <div className="card-header"><div><p className="section-label">Acompañamiento</p><h2>Línea de tiempo de apoyo</h2><span>Tutorías, observaciones y derivaciones registradas.</span></div></div>
          <div className="support-timeline">
            {supportEvents.length > 0 ? supportEvents.map((event, index) => (
              <div className="support-event" key={`${event.type}-${event.date}-${index}`}>
                <span className="support-event-icon"><Icon name={event.type === "Tutoría" ? "students" : event.type === "Derivación docente" ? "send" : "alerts"} size={17} /></span>
                <div>
                  <small>{event.date} · {event.type}</small>
                  <strong>{event.title}</strong>
                  <p>{event.details}</p>
                </div>
              </div>
            )) : <p className="empty-history">No hay acciones de apoyo registradas.</p>}
          </div>
        </article>
        <article className="card action-results-card">
          <div className="card-header"><div><p className="section-label">Resultados</p><h2>¿Funcionó la acción?</h2><span>Comparación del promedio antes y después de cada tutoría.</span></div></div>
          <div className="action-results-list">
            {student.tutorias.length > 0 ? student.tutorias.map((tutoria, index) => {
              const improved = student.alumno.promedios_bimestre.B2 > student.alumno.promedios_bimestre.B1;
              return (
                <div key={`${tutoria.fecha}-${tutoria.accion}-${index}`}>
                  <div><strong>{tutoria.accion}</strong><span>{tutoria.fecha} · {tutoria.motivo}</span></div>
                  <span>{student.alumno.promedios_bimestre.B1} → {student.alumno.promedios_bimestre.B2}</span>
                  <span className={improved ? "result-improved" : "result-not-improved"}>{improved ? "Mejoró" : "No mejoró"}</span>
                </div>
              );
            }) : <p className="empty-history">Aún no hay acciones aplicadas.</p>}
          </div>
          <div className="action-results-footer">
            <Button secondary onClick={() => {
              navigate("alert");
              window.setTimeout(() => document.getElementById("solucion-recomendada")?.scrollIntoView({ behavior: "smooth" }), 0);
            }}>Ver otras acciones recomendadas</Button>
          </div>
        </article>
      </section>
      <div className="action-bar">
        <Button secondary onClick={() => navigate("alert")} icon="arrow">Volver a alerta</Button>
        <div>
          {canCommunicate && <Button secondary onClick={() => navigate("communication")}>Comunicar a la familia</Button>}
          {canCommunicate && <Button onClick={openFollowUp}>Registrar seguimiento</Button>}
        </div>
      </div>
    </>
  );
}
