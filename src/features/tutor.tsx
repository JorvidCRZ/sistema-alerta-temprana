import { useEffect, useState, type FormEvent } from "react";
import {
  calcularPromedioCurso,
  calcularPromedioGeneralBimestre,
  ETIQUETAS_EVALUACION,
  TIPOS_EVALUACION,
  getAccionesSugeridas,
  normalizarBimestreNumero,
  parsearFactoresRiesgo,
  registrarTutoria,
  useDataStore,
  type AccionTutoria,
  type DerivacionTutoria,
  type Estudiante,
  type Motivo,
  type RecalculoRiesgo,
  type TipoEvaluacion,
} from "../data";
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
  const { estudiantes: todosEstudiantes, modelo } = useDataStore();
  const [dashboardPage, setDashboardPage] = useState(1);
  const itemsPerPage = 10;

  // Dashboard muestra todos los estudiantes (sin filtro por sección)
  const estudiantes = todosEstudiantes;

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
                        <div><strong>{student.alumno.nombre}</strong><span>{student.alumno.grado != null ? `${student.alumno.grado}.º Sec. · ${student.alumno.letra ?? "?"}` : "3.º Sec."}</span></div>
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
  const { estudiantes: todosEstudiantes, secciones } = useDataStore();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("Todos");
  const [seccionFiltro, setSeccionFiltro] = useState("Todas");
  const [studentsPage, setStudentsPage] = useState(1);
  const itemsPerPage = 10;

  // Letras disponibles según backend (o derivadas de estudiantes)
  const letrasDisponibles = secciones.length > 0
    ? secciones.map((s) => s.letra).sort()
    : [...new Set(todosEstudiantes.map((s) => s.alumno.letra).filter(Boolean))].sort() as string[];

  const filtered = todosEstudiantes
    .filter(
      (student) =>
        student.alumno.nombre.toLowerCase().includes(query.toLowerCase()) &&
        (risk === "Todos" || student.riesgo.nivel === risk) &&
        (seccionFiltro === "Todas" || (student.alumno.letra ?? "?") === seccionFiltro),
    )
    .sort((a, b) => b.riesgo.probabilidad - a.riesgo.probabilidad);

  const totalStudentsPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentStudentsPage = Math.min(studentsPage, totalStudentsPages);
  const paginatedStudents = filtered.slice(
    (currentStudentsPage - 1) * itemsPerPage,
    currentStudentsPage * itemsPerPage,
  );

  const subtitle =
    seccionFiltro === "Todas"
      ? "Listado general de 3.º de Secundaria (todas las secciones)"
      : `Listado de la sección 3.º de Secundaria – ${seccionFiltro}`;

  return (
    <>
      <PageHeading title="Estudiantes" subtitle={subtitle} />
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
          {/* Filtro de sección — sólo en esta tabla */}
          {letrasDisponibles.length > 0 && (
            <div className="section-filter-chips" role="group" aria-label="Filtrar por sección">
              <button
                type="button"
                className={`section-chip${seccionFiltro === "Todas" ? " active" : ""}`}
                onClick={() => { setSeccionFiltro("Todas"); setStudentsPage(1); }}
              >
                Todas
              </button>
              {letrasDisponibles.map((letra) => (
                <button
                  key={letra}
                  type="button"
                  className={`section-chip${seccionFiltro === letra ? " active" : ""}`}
                  onClick={() => { setSeccionFiltro(letra); setStudentsPage(1); }}
                >
                  {letra}
                </button>
              ))}
            </div>
          )}
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
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Estudiante</th><th>Código</th><th title="Promedio del Bimestre 1 al Bimestre 2">Promedio Bim. 1 → Bim. 2</th><th>Inasistencias</th><th>Tendencia</th><th>Nivel de riesgo (%) <HelpHint text="Qué tan probable es que el estudiante termine el año con dificultades." /></th><th>Nivel</th><th>Acción recomendada</th><th>Acciones</th></tr></thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student.alumno.id_matricula}>
                  <td><div className="student-cell"><span className="student-avatar">{student.alumno.nombre.split(" ").map((part) => part[0]).join("")}</span><div><strong>{student.alumno.nombre}</strong><span>{student.alumno.grado != null ? `${student.alumno.grado}.º Sec. · ${student.alumno.letra ?? "?"}` : "3.º Sec."}</span></div></div></td>
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
        <span>{student.alumno.grado != null ? `${student.alumno.grado}.º de Secundaria – ${student.alumno.letra ?? "?"}` : "3.º de Secundaria"} · Código {student.alumno.codigo}</span>
      </div>
      <div className="banner-risk">
        <span>Nivel actual</span>
        <RiskBadge level={student.riesgo.nivel} />
      </div>
    </div>
  );
}

function formatearPuntos(valor: number): string {
  if (Math.abs(valor) < 0.05) return "sin cambio";
  return `${valor > 0 ? "+" : "−"}${Math.abs(valor).toFixed(1)} puntos`;
}

// Texto simple para el tutor: por qué el estudiante tiene este nivel de riesgo.
function explicarRiesgo(student: Estudiante): string {
  const factores = [...parsearFactoresRiesgo(student.riesgo.factores)].sort(
    (a, b) => Math.abs(b.valor) - Math.abs(a.valor),
  );
  const b1 = Math.round(student.alumno.promedios_bimestre.B1);
  const b2 = Math.round(student.alumno.promedios_bimestre.B2);
  const faltas = student.alumno.inasistencias;

  const señales: string[] = [];
  if (b2 < b1) señales.push(`su promedio bajó de ${b1} a ${b2} entre el Bimestre 1 y el 2`);
  else if (b2 < 11) señales.push(`su promedio del Bimestre 2 es ${b2} (menos de 11 es desaprobado)`);
  if (faltas > 0) {
    señales.push(`acumula ${faltas} ${faltas === 1 ? "inasistencia" : "inasistencias"}`);
  }

  const motivos = factores
    .slice(0, 2)
    .map((factor) => displayFactorFamily(factor.familia).toLowerCase());

  return [
    `${student.alumno.nombre} tiene riesgo ${student.riesgo.nivel.toLowerCase()}${
      señales.length ? `: ${señales.join(" y ")}.` : "."
    }`,
    motivos.length ? `Lo que más pesa es ${motivos.join(", seguido de ")}.` : "",
    "Es una señal para acompañarlo a tiempo, no una sanción ni una etiqueta.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Explica el porcentaje de cada acción: "Mejoró en 2 de 10 casos parecidos".
function EvidenciaAccion({
  pct,
  nCasos,
  nMejoraron,
  variacion,
  alcanceTexto,
}: {
  pct: number;
  nCasos: number;
  nMejoraron?: number;
  variacion: number;
  alcanceTexto: string;
}) {
  // Si el backend manda el conteo exacto se usa; si no, se estima desde el porcentaje.
  const mejoraron = nMejoraron ?? Math.round((pct * nCasos) / 100);
  return (
    <>
      <div className="pattern-metrics">
        <span>
          Mejoró en {mejoraron} de {nCasos} casos parecidos{alcanceTexto}
        </span>
        <span>Cambio medio del promedio: {formatearPuntos(variacion)}</span>
      </div>
      {nCasos < 15 && (
        <p className="patterns-warning">Pocos casos: tómalo solo como referencia.</p>
      )}
    </>
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
  const [apiData, setApiData] = useState<RiesgoSolucionAPI | null>(null);
  const fallbackProfiles = getStudentReasons(student);
  const [activeProfile, setActiveProfile] = useState<Motivo | null>(fallbackProfiles[0] ?? null);

  useEffect(() => {
    let activo = true;
    const idNum = Number(String(student.alumno.id_matricula).replace(/\D/g, "")) || 1;

    setApiData(null);
    fetch(`http://127.0.0.1:8000/estudiantes/${idNum}/riesgo-solucion`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: RiesgoSolucionAPI | null) => {
        if (!activo) return;
        if (data) {
          setApiData(data);
          const factorProfiles = data.factores
            .map((factor) => factor.motivo)
            .filter((motivo, index, motivos) => motivo && motivos.indexOf(motivo) === index);
          const profiles = data.motivo_principal
            ? [data.motivo_principal, ...factorProfiles.filter((motivo) => motivo !== data.motivo_principal), ...fallbackProfiles.filter((motivo) => motivo !== data.motivo_principal && !factorProfiles.includes(motivo))]
            : [...factorProfiles, ...fallbackProfiles.filter((motivo) => !factorProfiles.includes(motivo))];
          setActiveProfile(profiles[0] ?? null);
        } else {
          setActiveProfile(fallbackProfiles[0] ?? null);
        }
      })
      .catch(() => {
        if (activo) {
          setApiData(null);
          setActiveProfile(fallbackProfiles[0] ?? null);
        }
      });

    return () => {
      activo = false;
    };
  }, [student.alumno.id_matricula]);

  const factorProfiles = apiData?.factores
    .map((factor) => factor.motivo)
    .filter((motivo, index, motivos) => motivo && motivos.indexOf(motivo) === index) ?? [];
  const visibleProfiles = apiData
    ? apiData.motivo_principal
      ? [apiData.motivo_principal, ...factorProfiles.filter((motivo) => motivo !== apiData.motivo_principal), ...fallbackProfiles.filter((motivo) => motivo !== apiData.motivo_principal && !factorProfiles.includes(motivo))]
      : [...factorProfiles, ...fallbackProfiles.filter((motivo) => !factorProfiles.includes(motivo))]
    : fallbackProfiles;

  const saveSuggestedAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPattern) return;
    const idNum = Number(String(student.alumno.id_matricula).replace(/\D/g, "")) || 1;

    try {
      const response = await fetch(`http://127.0.0.1:8000/estudiantes/${idNum}/tutorias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: date,
          motivo: selectedPattern.reason,
          accion: selectedPattern.action,
          derivacion: destination,
          nota: note.trim() || undefined,
          tutor: tutorName,
        }),
      });

      if (!response.ok) throw new Error("Backend no disponible");
      const data = await response.json() as TutoriaBackendPostResponse;

      setApiData((current) => current ? { ...current, ya_aplicadas: data.ya_aplicadas } : current);

      if (!data.duplicado_hoy) {
        registrarTutoria(student.alumno.id_matricula, {
          fecha: date,
          motivo: selectedPattern.reason,
          accion: selectedPattern.action,
          derivacion: destination,
          mejoro_sim: false,
          nota: note.trim() || undefined,
          tutor: tutorName,
        });
      }
      setConfirmation(data.mensaje);
    } catch {
      registrarTutoria(student.alumno.id_matricula, {
        fecha: date,
        motivo: selectedPattern.reason,
        accion: selectedPattern.action,
        derivacion: destination,
        mejoro_sim: false,
        nota: note.trim() || undefined,
        tutor: tutorName,
      });
      setConfirmation("El seguimiento fue registrado localmente y ya aparece en el historial del estudiante.");
    }

    setSelectedPattern(null);
  };

  return (
    <article className="card suggested-actions solution-feature" id="solucion-recomendada">
      <p className="section-label">Solución recomendada</p>
      <h2>Para {student.alumno.nombre}, con motivo principal: {visibleProfiles[0] ?? "Por revisar"}</h2>
      <p className="risk-explainer">{explicarRiesgo(student)}</p>
      <p className="patterns-warning">
        {apiData && apiData.soluciones.length > 0
          ? "Sugerencia calculada desde casos históricos del colegio. Es una guía, no una garantía; el tutor decide."
          : "Sugerencia basada en casos similares del colegio (datos de demostración). Es una guía, no una garantía; el tutor decide."}
      </p>

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
        if (apiData && activeProfile === apiData.motivo_principal) {
          const recommended = apiData.soluciones.find((solution) => solution.recomendada) ?? apiData.soluciones[0];
          const alternatives = apiData.soluciones.filter((solution) => solution.nombre !== recommended?.nombre);
          if (!recommended) return <p className="insufficient-patterns">Aún no hay suficiente información para sugerir una acción en este motivo.</p>;

          const today = new Date().toISOString().slice(0, 10);
          const renderApiApplied = (accion: string) => apiData.ya_aplicadas
            .filter((item) => item.accion === accion)
            .map((item, index) => {
              const enSeguimiento = item.fecha === today || item.mejoro_sim === null;
              return (
                <div className="previous-action" key={`${item.fecha}-${index}`}>
                  <Icon name="check" size={14} /> Ya aplicada el {item.fecha} · Resultado: {enSeguimiento ? "Registrada hoy (en seguimiento)" : item.mejoro_sim ? "Mejoró" : "No mejoró"}
                </div>
              );
            });

          return (
            <section className="pattern-profile">
              <div className="recommended-action">
                <span className="recommended-chip">Recomendada</span>
                <small>Acción recomendada</small>
                <strong>{recommended.nombre}</strong>
                <p>
                  Esta acción tiene el mejor resultado en casos parecidos: el promedio mejoró en{" "}
                  <strong>
                    {recommended.n_mejoraron ?? Math.round((recommended.pct_mejoro * recommended.n_casos) / 100)} de {recommended.n_casos} casos
                  </strong>{" "}
                  ({Math.round(recommended.pct_mejoro)} %
                  {recommended.alcance === "colegio" ? " · todo el colegio" : " · 3.º Sec."}).
                  {recommended.n_casos < 15 && " Son pocos casos: tómalo como referencia."}
                </p>
                {renderApiApplied(recommended.nombre)}
                {!readOnly && (() => {
                  const yaRegistradaHoy = registroRegistradoHoy(recommended.nombre, apiData.ya_aplicadas, student.tutorias);
                  return (
                    <Button
                      onClick={() => setSelectedPattern({ reason: activeProfile, action: recommended.nombre })}
                      disabled={yaRegistradaHoy}
                    >
                      {yaRegistradaHoy ? "Ya registrada hoy" : "Aplicar esta acción"}
                    </Button>
                  );
                })()}
              </div>
              {alternatives.length > 0 && (
                <>
                  <h3>Otras opciones</h3>
                  <p className="patterns-warning">
                    Cómo leerlo: el porcentaje indica en cuántos casos parecidos mejoró el promedio del estudiante en el bimestre siguiente después de aplicar esa acción (por ejemplo, 20 % = mejoró en 2 de 10 casos). Es una referencia basada en casos pasados, no una garantía; el tutor decide.
                  </p>
                </>
              )}
              {alternatives.map((solution) => {
                const yaRegistradaHoy = registroRegistradoHoy(solution.nombre, apiData.ya_aplicadas, student.tutorias);
                return (
                  <div className="pattern-action" key={solution.nombre}>
                    <div className="pattern-action-heading">
                      <strong>{solution.nombre}</strong>
                      <span>{Math.round(solution.pct_mejoro)} %</span>
                    </div>
                    <div className="pattern-bar" aria-label={`${Math.round(solution.pct_mejoro)} % de casos con mejora`}>
                      <span style={{ width: `${Math.round(solution.pct_mejoro)}%` }} />
                    </div>
                    <EvidenciaAccion
                      pct={solution.pct_mejoro}
                      nCasos={solution.n_casos}
                      nMejoraron={solution.n_mejoraron}
                      variacion={solution.variacion_media}
                      alcanceTexto={solution.alcance === "colegio" ? " · todo el colegio" : " · 3.º Sec."}
                    />
                    {renderApiApplied(solution.nombre)}
                    {!readOnly && <Button
                      secondary
                      disabled={yaRegistradaHoy}
                      onClick={() => {
                        setSelectedPattern({ reason: activeProfile, action: solution.nombre });
                        setConfirmation("");
                      }}
                    >
                      {yaRegistradaHoy ? "Ya registrada hoy" : "Elegir otra acción"}
                    </Button>}
                  </div>
                );
              })}
            </section>
          );
        }

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
              <p>
                Esta acción tiene el mejor resultado en casos parecidos: el promedio mejoró en{" "}
                <strong>
                  {Math.round((recommended.pct_mejoro * recommended.n_casos) / 100)} de {recommended.n_casos} casos
                </strong>{" "}
                ({Math.round(recommended.pct_mejoro)} %).
                {recommended.n_casos < 15 && " Son pocos casos: tómalo como referencia."}
              </p>
              {recommended.aplicaciones.map((tutoring, index) => {
                const today = new Date().toISOString().slice(0, 10);
                const enSeguimiento = tutoring.fecha === today || tutoring.mejoro_sim === null;
                return (
                  <div className="previous-action" key={`${tutoring.fecha}-${index}`}>
                    <Icon name="check" size={14} /> Ya aplicada el {tutoring.fecha} · Resultado: {enSeguimiento ? "Registrada hoy (en seguimiento)" : tutoring.mejoro_sim ? "Mejoró" : "No mejoró"}
                  </div>
                );
              })}
              {!readOnly && (() => {
                const yaRegistradaHoy = registroRegistradoHoy(recommended.nombre, apiData?.ya_aplicadas ?? [], student.tutorias);
                return (
                  <Button
                    onClick={() => setSelectedPattern({ reason: activeProfile, action: recommended.nombre })}
                    disabled={yaRegistradaHoy}
                  >
                    {yaRegistradaHoy ? "Ya registrada hoy" : "Aplicar esta acción"}
                  </Button>
                );
              })()}
            </div>
            {alternatives.length > 0 && (
              <>
                <h3>Otras opciones</h3>
                <p className="patterns-warning">
                  Cómo leerlo: el porcentaje indica en cuántos casos parecidos mejoró el promedio del estudiante en el bimestre siguiente después de aplicar esa acción (por ejemplo, 20 % = mejoró en 2 de 10 casos). Es una referencia basada en casos pasados, no una garantía; el tutor decide.
                </p>
              </>
            )}
            {alternatives.map((action) => {
              const yaRegistradaHoy = registroRegistradoHoy(action.nombre, apiData?.ya_aplicadas ?? [], student.tutorias);
              return (
                <div className="pattern-action" key={action.nombre}>
                  <div className="pattern-action-heading">
                    <strong>{action.nombre}</strong>
                    <span>{Math.round(action.pct_mejoro)} %</span>
                  </div>
                  <div className="pattern-bar" aria-label={`${Math.round(action.pct_mejoro)} % de casos con mejora`}>
                    <span style={{ width: `${Math.round(action.pct_mejoro)}%` }} />
                  </div>
                  <EvidenciaAccion
                    pct={action.pct_mejoro}
                    nCasos={action.n_casos}
                    variacion={action.variacion_media}
                    alcanceTexto=""
                  />
                  {action.aplicaciones.map((tutoring, index) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const enSeguimiento = tutoring.fecha === today || tutoring.mejoro_sim === null;
                    return (
                      <div className="previous-action" key={`${tutoring.fecha}-${index}`}>
                        <Icon name="check" size={14} /> Ya aplicada el {tutoring.fecha} · Resultado: {enSeguimiento ? "Registrada hoy (en seguimiento)" : tutoring.mejoro_sim ? "Mejoró" : "No mejoró"}
                      </div>
                    );
                  })}
                  {!readOnly && <Button
                    secondary
                    disabled={yaRegistradaHoy}
                    onClick={() => {
                      setSelectedPattern({ reason: activeProfile, action: action.nombre });
                      setConfirmation("");
                    }}
                  >
                    {yaRegistradaHoy ? "Ya registrada hoy" : "Elegir otra acción"}
                  </Button>}
                </div>
              );
            })}
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
              {[...factors]
                .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
                .map((factor, index) => {
                  const weightRatio = Math.min(1, Math.abs(factor.valor) / maxFactorValue);
                  const weightLabel = weightRatio >= 0.67 ? "Alto" : weightRatio >= 0.34 ? "Medio" : "Bajo";
                  return (
                    <div className="factor-row" key={factor.familia}>
                      <div className="factor-copy">
                        <div>
                          {index === 0 && <span className="factor-main-label">Factor principal</span>}
                          <strong>{displayFactorFamily(factor.familia)}</strong>
                        </div>
                        <span>Peso: {weightLabel}</span>
                      </div>
                      <div
                        className="factor-bar"
                        role="progressbar"
                        aria-label={`Peso de ${displayFactorFamily(factor.familia)}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(weightRatio * 100)}
                      >
                        <span style={{ width: `${weightRatio * 100}%` }} />
                      </div>
                      <small className="factor-points">{factor.valor >= 0 ? "+" : ""}{factor.valor.toFixed(1)} pts</small>
                    </div>
                  );
                })}
            </div>
            <p className="factor-support-note">Señales compatibles con riesgo académico. Es un apoyo para el tutor, no determina una causa ni una consecuencia por sí sola.</p>
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
  cursoDrilldown,
  bimestreDetalle,
}: {
  student: Estudiante;
  cursoDrilldown: string | null;
  bimestreDetalle: number;
}) {
  const calificaciones = student.calificaciones ?? [];

  if (cursoDrilldown !== null) {
    // ── Vista de barras para el curso y bimestre seleccionado ──────────
    const detalle = calcularPromedioCurso(calificaciones, cursoDrilldown, bimestreDetalle);
    const barras: {
      key: string;
      label: string;
      value: number | null;
      isAverage?: boolean;
      subtext?: string;
    }[] = [
      { key: "Practica", label: "Práctica (30%)", value: detalle.evaluaciones.Practica },
      { key: "Simulacro", label: "Simulacro (20%)", value: detalle.evaluaciones.Simulacro },
      { key: "Examen", label: "Examen (50%)", value: detalle.evaluaciones.Examen },
      {
        key: "Promedio",
        label: "Promedio",
        value: detalle.promedio,
        isAverage: true,
        subtext: detalle.esParcial ? "promedio parcial" : undefined,
      },
    ];

    return (
      <div className="course-detail-chart" aria-label={`Detalle de ${cursoDrilldown} (B${bimestreDetalle})`}>
        <div className="chart-wrap bar-detail-wrap">
          <div className="chart-y">
            {[20, 15, 10, 5, 0].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div className="bar-detail-grid">
            {barras.map((bar) => {
              const heightPct = bar.value !== null ? Math.min(100, Math.max(0, (bar.value / 20) * 100)) : 0;
              return (
                <div className="bar-detail-col" key={bar.key}>
                  <div className="bar-detail-track">
                    {bar.value !== null ? (
                      <div
                        className={`bar-detail-fill ${bar.isAverage ? "is-average" : ""}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        <span className="bar-detail-val">{bar.value}</span>
                      </div>
                    ) : (
                      <span className="bar-detail-empty">Sin nota</span>
                    )}
                  </div>
                  <span className="bar-detail-label">{bar.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="course-eval-cards">
          {barras.map((bar) => (
            <div
              key={bar.key}
              className={`course-eval-card ${bar.isAverage ? "is-average" : ""}`}
            >
              <span className="course-eval-title">
                {bar.isAverage ? "Promedio del curso" : bar.label}
              </span>
              <strong className={bar.value === null ? "is-missing" : ""}>
                {bar.value !== null ? bar.value : bar.isAverage ? "pendiente" : "Sin nota"}
              </strong>
              {bar.subtext && <small className="partial-tag">{bar.subtext}</small>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vista general (todos los cursos) ───────────────────────────────
  const pb = student.alumno.promedios_bimestre;
  const bimConProm: { label: string; value: number }[] = [];
  if (pb.B1) bimConProm.push({ label: "Bimestre 1", value: Math.round(pb.B1) });
  if (pb.B2) bimConProm.push({ label: "Bimestre 2", value: Math.round(pb.B2) });
  if (pb.B3 != null && pb.B3 > 0) bimConProm.push({ label: "Bimestre 3", value: Math.round(pb.B3) });
  if (pb.B4 != null && pb.B4 > 0) bimConProm.push({ label: "Bimestre 4", value: Math.round(pb.B4) });

  // Si hay calificaciones en sesión para bimestres no reflejados, calcular el promedio
  const calBimestres = new Set(calificaciones.map((c) => normalizarBimestreNumero(c.bimestre)));
  for (const bim of [3, 4]) {
    if (
      calBimestres.has(bim) &&
      !bimConProm.find((p) => p.label === `Bimestre ${bim}`)
    ) {
      const pg = calcularPromedioGeneralBimestre(
        calificaciones,
        student.notas_por_curso.map((n) => n.curso),
        bim,
      );
      if (pg.promedio !== null) {
        const label = `Bimestre ${bim}${pg.esParcial ? " (parcial)" : ""}`;
        bimConProm.push({ label, value: Math.round(pg.promedio) });
      }
    }
  }

  const nPts = bimConProm.length;
  const svgWidth = 600;
  const xPadding = 60;
  const xPositions =
    nPts === 1
      ? [svgWidth / 2]
      : bimConProm.map((_, i) => xPadding + (i * (svgWidth - xPadding * 2)) / (nPts - 1));
  const chartPoints = bimConProm.map((p, i) => ({
    ...p,
    x: xPositions[i],
    y: 175 - p.value * 7.5,
  }));
  const path = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      className="chart-wrap performance-chart"
      aria-label={`Rendimiento general de ${student.alumno.nombre}`}
    >
      <div className="chart-y">
        {[20, 15, 10, 5, 0].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
      <svg viewBox="0 0 600 220" role="img">
        <title>Promedios generales por bimestre</title>
        {[20, 15, 10, 5, 0].map((v) => {
          const y = 175 - v * 7.5;
          return (
            <line key={v} x1="25" x2="575" y1={y} y2={y} className="grid-line" />
          );
        })}
        <polyline points={path} className="area-line" />
        {chartPoints.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="6" className="chart-point" />
            <text x={p.x} y={p.y - 15} textAnchor="middle" className="chart-value">
              {Math.round(p.value)}
            </text>
            <text x={p.x} y="207" textAnchor="middle" className="axis-label">
              {p.label}
            </text>
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
      <article className="card wide ia-diagnosis-card" style={{ gridColumn: "1 / -1" }}>
        <p className="section-label">Diagnóstico IA · Gemini + Random Forest</p>
        <p>Analizando notas, asistencia y factores sociofamiliares en SQLite...</p>
      </article>
    );
  }

  if (!iaData) return null;

  return (
    <article className="card wide ia-diagnosis-card" style={{ gridColumn: "1 / -1" }}>
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
          <p className="section-label">Contexto familiar y entorno del estudiante</p>
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
  const { bimestreActual, totalBimestres } = useDataStore();
  const [cursoDrilldown, setCursoDrilldown] = useState<string | null>(null);
  const [bimestreDetalle, setBimestreDetalle] = useState<number>(() => bimestreActual);
  const [attendanceFilter, setAttendanceFilter] = useState<
    "Todos" | "Presente" | "Tardanza" | "Faltas" | "Falta justificada" | "Falta injustificada"
  >("Todos");
  const [attendancePage, setAttendancePage] = useState(1);
  const [apiTutorias, setApiTutorias] = useState<TutoriaBackend[]>([]);
  const calificaciones = student.calificaciones ?? [];

  useEffect(() => {
    setAttendancePage(1);
  }, [student.alumno.id_matricula, attendanceFilter]);

  useEffect(() => {
    let activo = true;
    setCursoDrilldown(null);
    setApiTutorias([]);
    const idNum = Number(String(student.alumno.id_matricula).replace(/\D/g, "")) || 1;

    fetch(`http://127.0.0.1:8000/estudiantes/${idNum}/tutorias`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!activo) return;
        let tutorias: TutoriaBackend[] = [];
        if (Array.isArray(data)) {
          tutorias = data as TutoriaBackend[];
        } else if (data && typeof data === "object" && "tutorias" in data) {
          const posibleLista = (data as { tutorias?: unknown }).tutorias;
          if (Array.isArray(posibleLista)) tutorias = posibleLista as TutoriaBackend[];
        }
        setApiTutorias(tutorias);
      })
      .catch(() => {
        if (activo) setApiTutorias([]);
      });

    return () => {
      activo = false;
    };
  }, [student.alumno.id_matricula]);

  const totalPresentes = student.asistencia_reciente.filter((a) => a.estado === "Presente").length;
  const totalTardanzas = student.asistencia_reciente.filter((a) => a.estado === "Tardanza").length;
  const totalJustificadas = student.asistencia_reciente.filter(
    (a) => a.estado === "Falta justificada",
  ).length;
  const totalInjustificadas = student.asistencia_reciente.filter(
    (a) => a.estado === "Falta injustificada",
  ).length;
  const filteredAttendance = student.asistencia_reciente.filter((a) => {
    if (attendanceFilter === "Todos") return true;
    if (attendanceFilter === "Faltas") {
      return a.estado === "Falta justificada" || a.estado === "Falta injustificada";
    }
    return a.estado === attendanceFilter;
  });
  const attendancePageSize = 10;
  const totalAttendancePages = Math.max(
    1,
    Math.ceil(filteredAttendance.length / attendancePageSize),
  );
  const safeAttendancePage = Math.min(attendancePage, totalAttendancePages);
  const paginatedAttendance = filteredAttendance.slice(
    (safeAttendancePage - 1) * attendancePageSize,
    safeAttendancePage * attendancePageSize,
  );

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
  const tutoriasLocalesNormalizadas: TutoriaBackend[] = student.tutorias.map((tutoria) => ({
    fecha: tutoria.fecha,
    motivo: tutoria.motivo,
    accion: tutoria.accion,
    derivacion: tutoria.derivacion,
    mejoro_sim: tutoria.mejoro_sim,
    nota: tutoria.nota,
    tutor: tutoria.tutor,
  }));
  const tutoriasCombinadas = [...tutoriasLocalesNormalizadas, ...apiTutorias].filter(
    (tutoria, index, lista) =>
      lista.findIndex((item) => item.fecha === tutoria.fecha && item.accion === tutoria.accion) === index,
  );
  const supportEvents: { date: string; type: string; title: string; details: string }[] = [
    ...tutoriasCombinadas.map((tutoria) => {
      const today = new Date().toISOString().slice(0, 10);
      const enSeguimiento = tutoria.fecha === today || tutoria.mejoro_sim === null;
      return {
        date: tutoria.fecha,
        type: "Tutoría",
        title: tutoria.motivo,
        details: `${tutoria.accion} · Derivación: ${tutoria.derivacion} · ${enSeguimiento ? "En seguimiento" : tutoria.mejoro_sim ? "Mejoró" : "No mejoró"}${tutoria.tutor ? ` · Tutor: ${tutoria.tutor}` : ""}${tutoria.nota ? ` · ${tutoria.nota}` : ""}`,
      };
    }),
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

  // Compilar lista de cursos con notas (de notas_por_curso + calificaciones de sesión)
  const nombresCursos = Array.from(
    new Set([
      ...student.notas_por_curso.map((n) => n.curso),
      ...calificaciones.map((c) => c.curso),
    ]),
  );

  // Bimestres visibles en la tabla (hasta bimestreActual o los que tengan datos)
  const colHeaders = Array.from({ length: totalBimestres }, (_, i) => i + 1).filter(
    (b) =>
      b <= bimestreActual ||
      nombresCursos.some(
        (curso) => calcularPromedioCurso(calificaciones, curso, b).tieneNotas,
      ),
  );
  const bimestresFiltro = Array.from({ length: totalBimestres }, (_, i) => i + 1).filter(
    (b) =>
      b <= bimestreActual ||
      nombresCursos.some(
        (curso) => calcularPromedioCurso(calificaciones, curso, b).tieneNotas,
      ),
  );
  const cursoActivo = cursoDrilldown;

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
                {cursoActivo
                  ? `Detalle de ${cursoActivo} (B${bimestreDetalle})`
                  : "Promedio general por bimestre"}
              </h2>
              {cursoActivo ? (
                <span>Evaluaciones ponderadas: Práctica 30 %, Simulacro 20 %, Examen 50 %.</span>
              ) : (
                <span>
                  {averageChange < 0
                    ? `El promedio bajó ${Math.abs(averageChange)} ${Math.abs(averageChange) === 1 ? "punto" : "puntos"} entre Bim. 1 y Bim. 2.`
                    : averageChange > 0
                      ? `El promedio subió ${averageChange} ${averageChange === 1 ? "punto" : "puntos"} entre Bim. 1 y Bim. 2.`
                      : "El promedio se mantuvo entre Bim. 1 y Bim. 2."}
                </span>
              )}
            </div>
            <div className="course-header-actions">
              {cursoActivo ? (
                <>
                  <select
                    aria-label="Filtrar por bimestre"
                    className="bimester-filter-select"
                    value={bimestreDetalle}
                    onChange={(e) => setBimestreDetalle(Number(e.target.value))}
                  >
                    {bimestresFiltro.map((b) => (
                      <option key={b} value={b}>
                        Bimestre {b}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="back-general-btn"
                    onClick={() => setCursoDrilldown(null)}
                  >
                    ← Vista general (todos los cursos)
                  </button>
                </>
              ) : (
                <span className="trend-chip">
                  <TrendIcon trend={calcularTendencia(b1, b2)} /> {calcularTendencia(b1, b2)}
                </span>
              )}
            </div>
          </div>

          <PerformanceChart
            student={student}
            cursoDrilldown={cursoActivo}
            bimestreDetalle={bimestreDetalle}
          />

          <div className="course-table">
            <div className="card-header">
              <div>
                <h2>Promedio por curso</h2>
                <p>
                  Escala de 0 a 20 (Práctica 30 % · Simulacro 20 % · Examen 50 %). Haz clic en un curso para ver sus evaluaciones.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Curso</th>
                    {colHeaders.map((b) => (
                      <th key={b} title={`Bimestre ${b}`}>
                        Bim. {b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nombresCursos.map((curso) => {
                    const npk = student.notas_por_curso.find((n) => n.curso === curso);
                    const isSelected = curso === cursoActivo;
                    return (
                      <tr
                        key={curso}
                        onClick={() => {
                          if (isSelected) {
                            setCursoDrilldown(null);
                          } else {
                            setCursoDrilldown(curso);
                          }
                        }}
                        className={isSelected ? "course-row-selected" : "course-row-clickable"}
                        title="Clic para ver evaluaciones del curso"
                      >
                        <td>
                          <strong>{curso}</strong>
                        </td>
                        {colHeaders.map((b) => {
                          const detalle = calcularPromedioCurso(calificaciones, curso, b);
                          let nota: number | null = detalle.promedio;
                          if (nota === null && npk && calificaciones.length === 0) {
                            nota = b === 1 ? npk.B1 : b === 2 ? npk.B2 : null;
                          }
                          if (nota === null) {
                            return (
                              <td key={b} className="grade-pending">
                                pendiente
                              </td>
                            );
                          }
                          return (
                            <td key={b} className={nota < 11 ? "failing-grade" : ""}>
                              {nota}
                              {detalle.esParcial && (
                                <small
                                  className="partial-asterisk"
                                  title="Promedio parcial: faltan tipos de evaluación"
                                >
                                  {" "}(parcial)
                                </small>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </article>
        <article className="card attendance-log">
          <div className="card-header">
            <div>
              <p className="section-label">Asistencia</p>
              <h2>Registro de asistencia de {student.alumno.nombre}</h2>
              <span>
                Total de inasistencias: {student.alumno.inasistencias} · Registros totales:{" "}
                {student.asistencia_reciente.length}
              </span>
            </div>
            <span className="access-note"><Icon name="info" size={15} /> Vista disponible solo para tutor y coordinación.</span>
          </div>
          <div className="attendance-toolbar">
            <div className="attendance-summary-chips">
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Todos" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Todos")}
              >
                Todos ({student.asistencia_reciente.length})
              </button>
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Presente" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Presente")}
              >
                Asistió ({totalPresentes})
              </button>
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Tardanza" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Tardanza")}
              >
                Tardanzas ({totalTardanzas})
              </button>
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Faltas" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Faltas")}
              >
                Faltas ({totalInjustificadas + totalJustificadas})
              </button>
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Falta justificada" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Falta justificada")}
              >
                Justificados ({totalJustificadas})
              </button>
              <button
                type="button"
                className={`attendance-filter-chip ${attendanceFilter === "Falta injustificada" ? "active" : ""}`}
                onClick={() => setAttendanceFilter("Falta injustificada")}
              >
                Injustificados ({totalInjustificadas})
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Ingreso</th><th>Estado</th><th>Medio</th></tr></thead>
              <tbody>
                {paginatedAttendance.length > 0 ? (
                  paginatedAttendance.map((attendance, index) => (
                    <tr key={`${attendance.fecha}-${index}`}>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty-history">
                      No hay registros de asistencia para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredAttendance.length > attendancePageSize && (
            <div className="attendance-pagination">
              <span>
                Mostrando {(safeAttendancePage - 1) * attendancePageSize + 1}–
                {Math.min(safeAttendancePage * attendancePageSize, filteredAttendance.length)} de{" "}
                {filteredAttendance.length} registros
              </span>
              <div className="attendance-pagination-controls">
                <button
                  type="button"
                  disabled={safeAttendancePage <= 1}
                  onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span>
                  Página {safeAttendancePage} de {totalAttendancePages}
                </span>
                <button
                  type="button"
                  disabled={safeAttendancePage >= totalAttendancePages}
                  onClick={() => setAttendancePage((p) => Math.min(totalAttendancePages, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
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
            {tutoriasCombinadas.length > 0 ? tutoriasCombinadas.map((tutoria, index) => {
              const today = new Date().toISOString().slice(0, 10);
              const enSeguimiento = tutoria.fecha === today || tutoria.mejoro_sim === null;
              const improved = tutoria.mejoro_sim === null ? false : tutoria.mejoro_sim;
              return (
                <div key={`${tutoria.fecha}-${tutoria.accion}-${index}`}>
                  <div><strong>{tutoria.accion}</strong><span>{tutoria.fecha} · {tutoria.motivo}</span></div>
                  <span>{b1} → {b2}</span>
                  <span className={enSeguimiento ? "result-not-improved" : improved ? "result-improved" : "result-not-improved"}>{enSeguimiento ? "En seguimiento" : improved ? "Mejoró" : "No mejoró"}</span>
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


interface SolucionRiesgoAPI {
  nombre: AccionTutoria;
  n_casos: number;
  n_mejoraron?: number;
  pct_mejoro: number;
  variacion_media: number;
  alcance: string;
  recomendada: boolean;
}

interface TutoriaAplicadaAPI {
  accion: string;
  fecha: string;
  mejoro_sim: boolean | null;
}

interface RiesgoSolucionAPI {
  id_matricula: number;
  motivo_principal: Motivo | null;
  factores: { factor: string; motivo: Motivo; peso: number }[];
  soluciones: SolucionRiesgoAPI[];
  ya_aplicadas: TutoriaAplicadaAPI[];
}

interface TutoriaBackendPostResponse {
  ok: boolean;
  duplicado_hoy: boolean;
  mensaje: string;
  ya_aplicadas: TutoriaAplicadaAPI[];
}

interface TutoriaBackend {
  fecha: string;
  motivo: Motivo;
  accion: AccionTutoria;
  derivacion: DerivacionTutoria;
  mejoro_sim: boolean | null;
  nota?: string;
  tutor?: string;
}

function registroRegistradoHoy(
  accion: string,
  apiAplicadas: TutoriaAplicadaAPI[],
  tutoriasLocales: Estudiante["tutorias"],
): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return (
    apiAplicadas.some((item) => item.accion === accion && item.fecha === today) ||
    tutoriasLocales.some((item) => item.accion === accion && item.fecha === today)
  );
}
