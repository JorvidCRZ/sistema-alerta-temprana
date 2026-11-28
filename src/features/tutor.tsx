import { useEffect, useState, type FormEvent } from "react";
import { bimestreACodigo, calcularPromedioCursoPonderado, calcularPromedioGeneral, cargarHistorialEstudianteDesdeBackend, getAccionesSugeridas, parsearFactoresRiesgo, registrarTutoria, useDataStore, type AccionTutoria, type BimestreCodigo, type DerivacionTutoria, type Estudiante, type Motivo, type RecalculoRiesgo } from "../data";
import { Button, HelpHint, Icon, PageHeading, RiskBadge, TrendIcon, calcularTendencia, formatearNivelPorcentaje, type IconName, type View } from "../components/common";
import { displayFactorFamily, getStudentReasons, getTopRecommendation } from "./recommendations";
import { etiquetaSeccion, useSecciones } from "../data/secciones";

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
  const { seccionDe } = useSecciones();
  const [dashboardPage, setDashboardPage] = useState(1);
  const itemsPerPage = 10;

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

  const totalDashboardPages = Math.max(1, Math.ceil(priorityStudents.length / itemsPerPage));
  const currentDashboardPage = Math.min(dashboardPage, totalDashboardPages);
  const paginatedPriorityStudents = priorityStudents.slice(
    (currentDashboardPage - 1) * itemsPerPage,
    currentDashboardPage * itemsPerPage,
  );

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
                {paginatedPriorityStudents.map((student) => {
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
                        <div><strong>{student.alumno.nombre}</strong><span>{etiquetaSeccion(seccionDe(student.alumno.id_matricula))}</span></div>
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
          {priorityStudents.length > itemsPerPage && (
            <div className="directory-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <p>
                Mostrando {(currentDashboardPage - 1) * itemsPerPage + 1}–
                {Math.min(currentDashboardPage * itemsPerPage, priorityStudents.length)} de{" "}
                <strong>{priorityStudents.length}</strong> estudiantes priorizados
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Button
                  secondary
                  onClick={() => setDashboardPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  Página {currentDashboardPage} de {totalDashboardPages}
                </span>
                <Button
                  secondary
                  onClick={() => setDashboardPage((p) => Math.min(totalDashboardPages, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
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
          Riesgo medio: desde {Math.round(modelo.umbrales.medio * 100)} % · Riesgo alto: desde {Math.round(modelo.umbrales.alto * 100)} %
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
  const { secciones, seccionDe } = useSecciones();
  const [seccion, setSeccion] = useState("Todas");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("Todos");
  const [studentsPage, setStudentsPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = estudiantes
    .filter(
      (student) =>
        student.alumno.nombre.toLowerCase().includes(query.toLowerCase()) &&
        (risk === "Todos" || student.riesgo.nivel === risk) &&
        (seccion === "Todas" || seccionDe(student.alumno.id_matricula) === seccion),
    )
    .sort((a, b) => b.riesgo.probabilidad - a.riesgo.probabilidad);

  const totalStudentsPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentStudentsPage = Math.min(studentsPage, totalStudentsPages);
  const paginatedStudents = filtered.slice(
    (currentStudentsPage - 1) * itemsPerPage,
    currentStudentsPage * itemsPerPage,
  );

  return (
    <>
      <PageHeading
        title="Estudiantes"
        subtitle={
          seccion === "Todas"
            ? "Listado de estudiantes de 3.º de Secundaria"
            : `Listado de la sección ${etiquetaSeccion(seccion)}`
        }
      />
      <section className="card student-directory">
        <div className="directory-toolbar">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setStudentsPage(1);
              }}
              placeholder="Buscar por nombre"
              aria-label="Buscar estudiante por nombre"
            />
          </label>
          <label className="filter-box">
            <Icon name="filter" size={17} />
            <span>Nivel de riesgo</span>
            <select
              value={risk}
              onChange={(event) => {
                setRisk(event.target.value);
                setStudentsPage(1);
              }}
              aria-label="Filtrar por nivel de riesgo"
            >
              <option>Todos</option>
              <option>Bajo</option>
              <option>Medio</option>
              <option>Alto</option>
            </select>
          </label>
          <label className="filter-box">
            <Icon name="filter" size={17} />
            <span>Sección</span>
            <select
              value={seccion}
              onChange={(event) => {
                setSeccion(event.target.value);
                setStudentsPage(1);
              }}
              aria-label="Filtrar por sección"
            >
              <option value="Todas">Todas</option>
              {secciones.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.letra} · {s.total_estudiantes} estudiantes
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Estudiante</th><th>Código</th><th title="Promedio del Bimestre 1 al Bimestre 2">Promedio Bim. 1 → Bim. 2</th><th>Inasistencias</th><th>Tendencia</th><th>Nivel de riesgo (%) <HelpHint text="Qué tan probable es que el estudiante termine el año con dificultades." /></th><th>Nivel</th><th>Acción recomendada</th><th>Acciones</th></tr></thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student.alumno.id_matricula}>
                  <td><div className="student-cell"><span className="student-avatar">{student.alumno.nombre.split(" ").map((part) => part[0]).join("")}</span><div><strong>{student.alumno.nombre}</strong><span>{etiquetaSeccion(seccionDe(student.alumno.id_matricula))}</span></div></div></td>
                  <td>{student.alumno.codigo}</td>
                  <td><strong className="average-value">{Math.round(student.alumno.promedios_bimestre.B1)} → {Math.round(student.alumno.promedios_bimestre.B2)}</strong></td>
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
        <div className="directory-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <p>
            <Icon name="info" size={17} /> Mostrando{" "}
            {filtered.length === 0 ? 0 : (currentStudentsPage - 1) * itemsPerPage + 1}–
            {Math.min(currentStudentsPage * itemsPerPage, filtered.length)} de{" "}
            <strong>{filtered.length}</strong> estudiantes
          </p>
          {filtered.length > itemsPerPage && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Button
                secondary
                onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                Página {currentStudentsPage} de {totalStudentsPages}
              </span>
              <Button
                secondary
                onClick={() => setStudentsPage((p) => Math.min(totalStudentsPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function StudentBanner({ student }: { student: Estudiante }) {
  const { seccionDe } = useSecciones();
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
        <span>{etiquetaSeccion(seccionDe(student.alumno.id_matricula))} · Código {student.alumno.codigo}</span>
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
              <p>En casos similares, esta acción ayudó a mejorar el promedio en el {Math.round(recommended.pct_mejoro)} % de los casos ({recommended.n_casos} casos).</p>
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
                    <span>{Math.round(action.pct_mejoro)} %</span>
                  </div>
                  <div className="pattern-bar" aria-label={`${Math.round(action.pct_mejoro)} % de casos con mejora`}>
                    <span style={{ width: `${Math.round(action.pct_mejoro)}%` }} />
                  </div>
                  <div className="pattern-metrics">
                    <span>{action.n_casos} casos</span>
                    <span>{action.variacion_media > 0 ? "+" : ""}{Math.round(action.variacion_media)} puntos de promedio</span>
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
  useEffect(() => {
    void cargarHistorialEstudianteDesdeBackend(student.alumno.id_matricula);
  }, [student.alumno.id_matricula]);
  const probabilityPercent = student.riesgo.probabilidad * 100;
  const factors = parsearFactoresRiesgo(student.riesgo.factores);
  const maxFactorValue = Math.max(...factors.map((factor) => Math.abs(factor.valor)), 0.01);
  const b1 = Math.round(student.alumno.promedios_bimestre.B1);
  const b2 = Math.round(student.alumno.promedios_bimestre.B2);
  const averageChange = b2 - b1;
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
                <span className="risk-threshold-label label-medium" style={{ left: `${modelo.umbrales.medio * 100}%` }}>{Math.round(modelo.umbrales.medio * 100)} %</span>
                <span className="risk-threshold threshold-high" style={{ left: `${modelo.umbrales.alto * 100}%` }} />
                <span className="risk-threshold-label label-high" style={{ left: `${modelo.umbrales.alto * 100}%` }}>{Math.round(modelo.umbrales.alto * 100)} %</span>
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
                    {b1} → {b2}
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
              <div><span>Promedio Bimestre 2</span><strong>{b2}</strong><small>de 20</small></div>
              <div><span>Promedio Bimestre 1</span><strong>{b1}</strong><small>de 20</small></div>
              <div><span>Inasistencias</span><strong>{student.alumno.inasistencias}</strong><small>este periodo</small></div>
              <div><span>Tendencia</span><strong className="trend-value"><TrendIcon trend={calcularTendencia(b1, b2)} />{calcularTendencia(b1, b2)}</strong></div>
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

function PerformanceChart({
  student,
  bimestreActual,
  selectedCourse,
  selectedBimestre,
}: {
  student: Estudiante;
  bimestreActual: number;
  selectedCourse: string | null;
  selectedBimestre: BimestreCodigo;
}) {
  const calificaciones = student.calificaciones ?? [];
  const cursos = student.notas_por_curso.map((c) => c.curso);

  if (selectedCourse) {
    const res = calcularPromedioCursoPonderado(calificaciones, selectedCourse, selectedBimestre);
    const items = [
      { label: "Práctica (30%)", value: res.practica },
      { label: "Simulacro (20%)", value: res.simulacro },
      { label: "Examen (50%)", value: res.examen },
      {
        label: res.esParcial ? "Promedio parcial" : "Promedio",
        value: res.promedio,
        isAvg: true,
      },
    ];
    const xPositions = [80, 225, 370, 515];

    return (
      <div className="course-detail-chart">
        <div className="chart-wrap performance-chart" aria-label={`Evaluaciones de ${selectedCourse}`}>
          <div className="chart-y">{[20, 15, 10, 5, 0].map((value) => <span key={value}>{value}</span>)}</div>
          <svg viewBox="0 0 600 220" role="img">
            <title>{selectedCourse} - {selectedBimestre}: Práctica, Simulacro, Examen y Promedio</title>
            {[20, 15, 10, 5, 0].map((value) => {
              const y = 175 - value * 7.5;
              return <line key={value} x1="25" x2="575" y1={y} y2={y} className="grid-line" />;
            })}
            {items.map((item, idx) => {
              const x = xPositions[idx];
              if (item.value === null) {
                return (
                  <g key={item.label}>
                    <line x1={x - 16} x2={x + 16} y1={175} y2={175} stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
                    <text x={x} y={160} textAnchor="middle" className="axis-label">Sin nota</text>
                    <text x={x} y="207" textAnchor="middle" className="axis-label">{item.label}</text>
                  </g>
                );
              }
              const y = 175 - item.value * 7.5;
              const barHeight = Math.max(4, 175 - y);
              const fill = item.isAvg
                ? item.value < 11
                  ? "#dc2626"
                  : "#0f2e8a"
                : item.value < 11
                  ? "#f87171"
                  : "#3b82f6";
              return (
                <g key={item.label}>
                  <rect x={x - 22} y={y} width="44" height={barHeight} rx="6" fill={fill} />
                  <text x={x} y={y - 10} textAnchor="middle" className="chart-value">
                    {item.value}
                  </text>
                  <text x={x} y="207" textAnchor="middle" className="axis-label">{item.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="course-eval-summary">
          <div className="eval-pill"><span>Práctica (30%)</span><strong>{res.practica !== null ? res.practica : "Sin nota"}</strong></div>
          <div className="eval-pill"><span>Simulacro (20%)</span><strong>{res.simulacro !== null ? res.simulacro : "Sin nota"}</strong></div>
          <div className="eval-pill"><span>Examen (50%)</span><strong>{res.examen !== null ? res.examen : "Sin nota"}</strong></div>
          <div className="eval-pill eval-pill-avg">
            <span>{res.esParcial ? "Promedio parcial" : "Promedio del curso"}</span>
            <strong>{res.promedio !== null ? res.promedio : "Pendiente"}</strong>
          </div>
        </div>
      </div>
    );
  }

  const g1 = calcularPromedioGeneral(calificaciones, cursos, "B1");
  const g2 = calcularPromedioGeneral(calificaciones, cursos, "B2");
  const g3 = calcularPromedioGeneral(calificaciones, cursos, "B3");
  const g4 = calcularPromedioGeneral(calificaciones, cursos, "B4");

  const points: Array<{ label: string; value: number; esParcial?: boolean }> = [
    {
      label: "Bimestre 1",
      value: g1.promedio ?? Math.round(student.alumno.promedios_bimestre.B1 * 10) / 10,
      esParcial: g1.esParcial,
    },
    {
      label: "Bimestre 2",
      value: g2.promedio ?? Math.round(student.alumno.promedios_bimestre.B2 * 10) / 10,
      esParcial: g2.esParcial,
    },
  ];
  if (bimestreActual >= 3 && g3.promedio !== null) {
    points.push({
      label: bimestreActual === 3 ? "Bimestre 3 (actual)" : "Bimestre 3",
      value: g3.promedio,
      esParcial: g3.esParcial,
    });
  }
  if (bimestreActual >= 4 && g4.promedio !== null) {
    points.push({
      label: "Bimestre 4 (actual)",
      value: g4.promedio,
      esParcial: g4.esParcial,
    });
  }

  const xPositions =
    points.length === 2
      ? [110, 490]
      : points.length === 3
        ? [80, 300, 520]
        : [70, 220, 380, 530];
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
        <title>Promedios por bimestre</title>
        {[20, 15, 10, 5, 0].map((value) => {
          const y = 175 - value * 7.5;
          return <line key={value} x1="25" x2="575" y1={y} y2={y} className="grid-line" />;
        })}
        <polyline points={path} className="area-line" />
        {chartPoints.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="6" className="chart-point" />
            <text x={point.x} y={point.y - 15} textAnchor="middle" className="chart-value">
              {point.value}
            </text>
            <text x={point.x} y="207" textAnchor="middle" className="axis-label">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

interface ExplicacionIAResponse {
  id_matricula: number;
  fuente: string;
  variables_que_aumentan_riesgo: string[];
  variables_que_reducen_riesgo: string[];
  analisis_factores_ocultos: string;
  conclusion_ia: string;
}

function DiagnosticoIA({ idMatricula }: { idMatricula: string }) {
  const [iaData, setIaData] = useState<ExplicacionIAResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);

    // Convierte "EST-0324" -> 324 o "12" -> 12
    const idNum = Number(String(idMatricula).replace(/\D/g, "")) || 1;

    fetch(`http://127.0.0.1:8000/estudiantes/${idNum}/explicacion-riesgo`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo) {
          setIaData(data);
          setCargando(false);
        }
      })
      .catch(() => {
        if (activo) {
          setIaData(null);
          setCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [idMatricula]);

  if (cargando) {
    return (
      <article className="card wide" style={{ gridColumn: "1 / -1" }}>
        <p className="section-label">Diagnóstico IA · Gemini + Random Forest</p>
        <p>Analizando notas, asistencia y factores sociofamiliares en SQLite...</p>
      </article>
    );
  }

  if (!iaData) return null;

  return (
    <article className="card wide" style={{ gridColumn: "1 / -1" }}>
      <div className="card-header">
        <div>
          <p className="section-label">Diagnóstico explicativo IA</p>
          <h2>Análisis de factores y conclusión para el tutor</h2>
        </div>
        <span className="update-chip">{iaData.fuente}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div className="human-note" style={{ margin: 0, alignItems: "flex-start" }}>
          <Icon name="alerts" />
          <div>
            <strong>Variables que aumentan el riesgo</strong>
            <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0 }}>
              {iaData.variables_que_aumentan_riesgo.map((item, idx) => (
                <li key={idx} style={{ marginBottom: "0.25rem" }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="human-note" style={{ margin: 0, alignItems: "flex-start" }}>
          <Icon name="check" />
          <div>
            <strong>Variables que reducen el riesgo</strong>
            <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0 }}>
              {iaData.variables_que_reducen_riesgo.map((item, idx) => (
                <li key={idx} style={{ marginBottom: "0.25rem" }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="evolution-summary" style={{ marginBottom: "1rem" }}>
        <div className="summary-mark"><Icon name="model" /></div>
        <div>
          <p className="section-label">Factores ocultos (distancia, familia, entorno)</p>
          <p>{iaData.analisis_factores_ocultos}</p>
        </div>
      </div>

      <div className="automatic-alert" style={{ margin: 0 }}>
        <span className="automatic-alert-icon"><Icon name="info" /></span>
        <p style={{ whiteSpace: "pre-line" }}>
          <strong>Conclusión IA: </strong>
          {iaData.conclusion_ia}
        </p>
      </div>
    </article>
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
  const { bimestreActual } = useDataStore();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [courseBimestre, setCourseBimestre] = useState<BimestreCodigo>(() =>
    bimestreACodigo(bimestreActual),
  );

  useEffect(() => {
    setSelectedCourse(null);
    void cargarHistorialEstudianteDesdeBackend(student.alumno.id_matricula);
  }, [student.alumno.id_matricula]);

  const b1 = Math.round(student.alumno.promedios_bimestre.B1);
  const b2 = Math.round(student.alumno.promedios_bimestre.B2);
  const averageChange = b2 - b1;
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
            <div>
              <p className="section-label">Rendimiento académico</p>
              <h2>
                {selectedCourse
                  ? `Detalle de ${selectedCourse} (${courseBimestre})`
                  : `Promedio del Bimestre 1 al Bimestre ${bimestreActual}`}
              </h2>
              <span>
                {selectedCourse
                  ? "Evaluaciones ponderadas: Práctica 30 %, Simulacro 20 %, Examen 50 %."
                  : averageChange < 0
                    ? `El promedio bajó ${Math.abs(averageChange)} ${Math.abs(averageChange) === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.`
                    : averageChange > 0
                      ? `El promedio subió ${averageChange} ${averageChange === 1 ? "punto" : "puntos"} entre el Bimestre 1 y el Bimestre 2.`
                      : "El promedio se mantuvo entre ambos bimestres."}
              </span>
            </div>
            {selectedCourse ? (
              <div className="course-chart-controls">
                <select
                  aria-label="Bimestre del curso"
                  value={courseBimestre}
                  onChange={(e) => setCourseBimestre(e.target.value as BimestreCodigo)}
                >
                  <option value="B1">Bimestre 1</option>
                  <option value="B2">Bimestre 2</option>
                  <option value="B3">Bimestre 3</option>
                  {bimestreActual >= 4 && <option value="B4">Bimestre 4</option>}
                </select>
                <Button secondary onClick={() => setSelectedCourse(null)} icon="arrow">
                  Vista general (todos los cursos)
                </Button>
              </div>
            ) : (
              <span className="trend-chip"><TrendIcon trend={calcularTendencia(b1, b2)} /> {calcularTendencia(b1, b2)}</span>
            )}
          </div>
          <PerformanceChart
            student={student}
            bimestreActual={bimestreActual}
            selectedCourse={selectedCourse}
            selectedBimestre={courseBimestre}
          />
          <div className="course-table">
            <div className="card-header">
              <div>
                <h2>Promedio por curso</h2>
                <p>Escala de 0 a 20 (Práctica 30 % · Simulacro 20 % · Examen 50 %). Haz clic en un curso para ver sus evaluaciones.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th title="Bimestre 1">Bim. 1</th>
                    <th title="Bimestre 2">Bim. 2</th>
                    <th title="Bimestre 3">Bim. 3</th>
                    {bimestreActual >= 4 && <th title="Bimestre 4">Bim. 4</th>}
                  </tr>
                </thead>
                <tbody>
                  {student.notas_por_curso.map((course) => {
                    const isSelected = selectedCourse === course.curso;
                    const renderCell = (nota: number | null | undefined, esParcial?: boolean) => {
                      if (nota === null || nota === undefined) {
                        return <td className="pending-grade">pendiente</td>;
                      }
                      return (
                        <td className={nota < 11 ? "failing-grade" : ""}>
                          {nota}
                          {esParcial && <span className="partial-badge" title="Promedio parcial: faltan evaluaciones"> parcial</span>}
                        </td>
                      );
                    };
                    return (
                      <tr
                        key={course.curso}
                        className={`course-row-clickable${isSelected ? " selected-course-row" : ""}`}
                        onClick={() => setSelectedCourse(isSelected ? null : course.curso)}
                      >
                        <td><strong>{course.curso}</strong></td>
                        {renderCell(course.B1, course.esParcialB1)}
                        {renderCell(course.B2, course.esParcialB2)}
                        {renderCell(course.B3, course.esParcialB3)}
                        {bimestreActual >= 4 && renderCell(course.B4, course.esParcialB4)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {(student.calificaciones?.length ?? 0) > 0 && (
            <div className="course-table" style={{ marginTop: "1rem" }}>
              <div className="card-header"><div><h2>Últimas evaluaciones</h2><p>Evaluaciones registradas en la base académica.</p></div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Fecha</th><th>Curso</th><th>Evaluación</th><th>Nota</th></tr></thead>
                  <tbody>
                    {[...(student.calificaciones ?? [])]
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .slice(0, 8)
                      .map((cal, idx) => (
                        <tr key={`${cal.fecha}-${cal.curso}-${idx}`}>
                          <td>{cal.fecha}</td>
                          <td><strong>{cal.curso}</strong></td>
                          <td>{cal.tipo_evaluacion} ({cal.bimestre})</td>
                          <td className={cal.nota < 11 ? "failing-grade" : ""}><strong>{cal.nota}</strong></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
        <DiagnosticoIA idMatricula={student.alumno.id_matricula} />
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
              const improved = b2 > b1;
              return (
                <div key={`${tutoria.fecha}-${tutoria.accion}-${index}`}>
                  <div><strong>{tutoria.accion}</strong><span>{tutoria.fecha} · {tutoria.motivo}</span></div>
                  <span>{b1} → {b2}</span>
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