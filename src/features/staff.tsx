import { useEffect, useRef, useState, type FormEvent } from "react";
import { actualizarDerivacion, crearDerivacion, estimarRiesgoSimulado, getEstudiantes, notificarTutor, registrarAsistencia, registrarCalificacion, registrarObservacion, registrarTutoria, useDataStore, type AccionTutoria, type DerivacionTutoria, type EstadoAsistencia, type TipoEvaluacion, type TipoObservacion, type Usuario } from "../data";
import { Button, HelpHint, Icon, PageHeading, RiskBadge, TrendIcon, type IconName, type View } from "../components/common";
import { getTopRecommendation } from "./recommendations";

export function DerivationsPage({
  readOnly,
  activeUser,
}: {
  readOnly: boolean;
  activeUser: Usuario;
}) {
  const { estudiantes } = useDataStore();
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<AccionTutoria>("Compromiso con el estudiante");
  const [destination, setDestination] = useState<DerivacionTutoria>("Ninguna");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const rows = estudiantes
    .flatMap((student) =>
      student.derivaciones.map((derivation) => ({
        derivation,
        student,
      })),
    )
    .filter(({ derivation }) => statusFilter === "Todos" || derivation.estado === statusFilter)
    .sort((a, b) => b.derivation.fecha.localeCompare(a.derivation.fecha));
  const selectedRow = estudiantes
    .flatMap((student) =>
      student.derivaciones.map((derivation) => ({ derivation, student })),
    )
    .find(({ derivation }) => derivation.id === selectedId);

  const markReviewed = () => {
    if (!selectedRow || readOnly) return;
    actualizarDerivacion(
      selectedRow.student.alumno.id_matricula,
      selectedRow.derivation.id,
      {
        estado: "Revisada",
        fecha_revision: new Date().toISOString().slice(0, 10),
        tutor: activeUser.nombre,
      },
    );
    setFeedback("La derivación fue marcada como revisada.");
  };

  const markAttended = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRow || readOnly) return;
    if (!note.trim()) {
      setFeedback("Escribe una nota de acompañamiento.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    actualizarDerivacion(
      selectedRow.student.alumno.id_matricula,
      selectedRow.derivation.id,
      {
        estado: "Atendida",
        fecha_revision: selectedRow.derivation.fecha_revision ?? today,
        accion_tutor: action,
        derivacion_tutoria: destination,
        nota_tutor: note.trim(),
        tutor: activeUser.nombre,
      },
    );
    registrarTutoria(selectedRow.student.alumno.id_matricula, {
      fecha: today,
      motivo: selectedRow.derivation.motivo.toLowerCase().includes("socioemocional")
        ? "Socioemocional"
        : "Conducta",
      accion: action,
      derivacion: destination,
      mejoro_sim: false,
      tutor: activeUser.nombre,
    });
    setFeedback("La acción fue registrada y la derivación quedó atendida.");
    setNote("");
  };

  const history = selectedRow
    ? [
        ...selectedRow.student.tutorias.map((item) => ({
          date: item.fecha,
          type: "Tutoría",
          detail: `${item.motivo} · ${item.accion}${item.tutor ? ` · Tutor: ${item.tutor}` : ""}`,
        })),
        ...selectedRow.student.observaciones_conducta.map((item) => ({
          date: item.fecha,
          type: "Observación",
          detail: `${item.tipo}${item.comentario ? ` · ${item.comentario}` : ""}`,
        })),
        ...selectedRow.student.derivaciones.map((item) => ({
          date: item.fecha_revision ?? item.fecha,
          type: "Derivación",
          detail: `${item.motivo} · ${item.estado}${item.tutor ? ` · Tutor: ${item.tutor}` : ""}`,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <PageHeading
        title="Derivaciones"
        subtitle={readOnly
          ? "Consulta de derivaciones docentes. Vista de solo lectura."
          : "Revisa y registra acciones de acompañamiento para las derivaciones docentes."}
      />
      <section className="card derivations-inbox">
        <div className="directory-toolbar">
          <div><p className="section-label">Bandeja</p><h2>Derivaciones de docentes</h2></div>
          <label className="filter-box">
            <Icon name="filter" size={17} />
            <span>Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>Todos</option>
              <option>Pendiente</option>
              <option>Revisada</option>
              <option>Atendida</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Docente y curso</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {rows.map(({ derivation, student }) => (
                <tr key={derivation.id}>
                  <td>{derivation.fecha}</td>
                  <td><strong>{student.alumno.nombre}</strong><br /><small>{student.alumno.codigo}</small></td>
                  <td><strong>{derivation.docente}</strong><br /><small>{derivation.curso}</small></td>
                  <td>{derivation.motivo}</td>
                  <td><span className={`derivation-status status-${derivation.estado.toLowerCase()}`}>{derivation.estado}</span></td>
                  <td><Button secondary onClick={() => {
                    setSelectedId(derivation.id);
                    const recommendation = getTopRecommendation(student);
                    if (recommendation) setAction(recommendation.nombre);
                    setFeedback("");
                  }}>Abrir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow && (
        <div className="derivation-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedId(null)}>
          <aside className="derivation-drawer" role="dialog" aria-modal="true" aria-labelledby="derivation-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div><p className="section-label">Derivación docente</p><h2 id="derivation-title">{selectedRow.student.alumno.nombre}</h2></div>
              <button type="button" className="modal-close" onClick={() => setSelectedId(null)} aria-label="Cerrar panel"><Icon name="close" /></button>
            </div>
            <div className="drawer-student">
              <div><span>Código</span><strong>{selectedRow.student.alumno.codigo}</strong></div>
              <div><span>Docente</span><strong>{selectedRow.derivation.docente}</strong></div>
              <div><span>Curso</span><strong>{selectedRow.derivation.curso}</strong></div>
              <div><span>Nivel actual</span><RiskBadge level={selectedRow.student.riesgo.nivel} /></div>
            </div>
            <section className="drawer-section">
              <h3>Observación</h3>
              <p>{selectedRow.derivation.comentario || "Sin observación adicional."}</p>
              <small>{selectedRow.derivation.fecha} · {selectedRow.derivation.motivo}</small>
            </section>
            <section className="drawer-section">
              <h3>Estado</h3>
              <span className={`derivation-status status-${selectedRow.derivation.estado.toLowerCase()}`}>{selectedRow.derivation.estado}</span>
              {selectedRow.derivation.fecha_revision && <p>Revisada el {selectedRow.derivation.fecha_revision}</p>}
              {selectedRow.derivation.tutor && <p><strong>Tutor:</strong> {selectedRow.derivation.tutor}</p>}
              {selectedRow.derivation.accion_tutor && <p><strong>Acción:</strong> {selectedRow.derivation.accion_tutor}</p>}
              {selectedRow.derivation.nota_tutor && <p><strong>Nota:</strong> {selectedRow.derivation.nota_tutor}</p>}
            </section>
            <section className="drawer-section drawer-recommendation">
              <h3>Acción recomendada para este caso</h3>
              {getTopRecommendation(selectedRow.student) ? (
                <>
                  <strong>{getTopRecommendation(selectedRow.student)?.nombre}</strong>
                  <p>Basada en casos similares registrados por el colegio.</p>
                </>
              ) : <p>Aún no hay suficiente información para sugerir una acción.</p>}
            </section>

            {!readOnly && selectedRow.derivation.estado === "Pendiente" && (
              <div className="drawer-primary-action">
                <Button onClick={markReviewed}>Marcar como revisada</Button>
              </div>
            )}

            {!readOnly && selectedRow.derivation.estado === "Revisada" && (
              <form className="drawer-action-form" onSubmit={markAttended}>
                <h3>Registrar acción y marcar atendida</h3>
                <label className="form-field"><span>Acción</span><select value={action} onChange={(event) => setAction(event.target.value as AccionTutoria)}><option>Compromiso con el estudiante</option><option>Citación al apoderado</option><option>Plan de recuperación</option><option>Seguimiento semanal</option><option>Orientación</option></select></label>
                <label className="form-field"><span>Derivación</span><select value={destination} onChange={(event) => setDestination(event.target.value as DerivacionTutoria)}><option value="Ninguna">Ninguna</option><option value="Psicologia">Psicología</option><option value="Coordinacion">Coordinación</option></select></label>
                <label className="form-field"><span>Nota</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registra acuerdos o aspectos por continuar." required /></label>
                <Button type="submit">Guardar y marcar atendida</Button>
              </form>
            )}

            {feedback && <div className="drawer-feedback" role="status"><Icon name="check" size={17} />{feedback}</div>}
            <section className="drawer-section drawer-history">
              <h3>Historial</h3>
              {history.map((item, index) => (
                <div key={`${item.type}-${item.date}-${index}`}>
                  <small>{item.date} · {item.type}</small>
                  <p>{item.detail}</p>
                </div>
              ))}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

export function TeacherSection({ activeUser }: { activeUser: Usuario }) {
  const { docentes, estudiantes } = useDataStore();
  const teacherProfile = docentes.find((teacher) => teacher.usuario_id === activeUser.id);
  const students = [...estudiantes].sort((a, b) =>
    a.alumno.nombre.localeCompare(b.alumno.nombre, "es"),
  );

  return (
    <>
      <PageHeading
        title="Mi sección"
        subtitle={`Estudiantes de ${teacherProfile?.grado ?? "3.º Secundaria"} – ${teacherProfile?.seccion ?? "A"}.`}
      />
      <section className="card teacher-student-list">
        <div className="card-header">
          <div><h2>Estudiantes</h2><p>Vista de acompañamiento para el docente.</p></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Estudiante</th><th>Código</th><th>Nivel</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.alumno.id_matricula}>
                  <td>
                    <div className="student-cell">
                      <span className="student-avatar">{student.alumno.nombre.split(" ").map((part) => part[0]).join("")}</span>
                      <div><strong>{student.alumno.nombre}</strong><span>3.º Sec. · A</span></div>
                    </div>
                  </td>
                  <td>{student.alumno.codigo}</td>
                  <td><RiskBadge level={student.riesgo.nivel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

type EvidenceTab = "nota" | "asistencia" | "observacion";

function StudentCombobox({
  estudiantes,
  value,
  onChange,
}: {
  estudiantes: ReturnType<typeof useDataStore>["estudiantes"];
  value: string;
  onChange: (idMatricula: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = estudiantes.find((s) => s.alumno.id_matricula === value);

  const normalize = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = estudiantes.filter((s) => {
    const target = normalize(`${s.alumno.nombre} ${s.alumno.codigo}`);
    return target.includes(normalize(query));
  });

  return (
    <div ref={containerRef} className="form-field" style={{ position: "relative" }}>
      <span>Alumno</span>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.7rem 0.9rem",
          borderRadius: "10px",
          border: "1px solid var(--border, #2b3245)",
          background: "var(--surface-2, #121622)",
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon name="search" size={16} />
          {selected
            ? `${selected.alumno.nombre} · ${selected.alumno.codigo}`
            : "Seleccionar alumno..."}
        </span>
        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "6px",
            background: "var(--surface, #161b29)",
            border: "1px solid var(--border, #2b3245)",
            borderRadius: "10px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0.6rem 0.85rem",
              borderBottom: "1px solid var(--border, #2b3245)",
              background: "var(--surface-2, #111520)",
            }}
          >
            <Icon name="search" size={16} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, apellido o código (ej. EST-0015)..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>

          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {filtered.length > 0 ? (
              filtered.map((student) => {
                const isSelected = student.alumno.id_matricula === value;
                return (
                  <li
                    key={student.alumno.id_matricula}
                    onClick={() => {
                      onChange(student.alumno.id_matricula);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      padding: "0.6rem 0.9rem",
                      cursor: "pointer",
                      background: isSelected ? "rgba(99, 102, 241, 0.22)" : "transparent",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {student.alumno.nombre} · <small>{student.alumno.codigo}</small>
                  </li>
                );
              })
            ) : (
              <li style={{ padding: "0.9rem", opacity: 0.7, textAlign: "center" }}>
                No se encontraron alumnos con "{query}"
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RegisterEvidence({ activeUser }: { activeUser: Usuario }) {
  const { cursos, estudiantes, bimestreActual, totalBimestres } = useDataStore();
  const bimestresDisponibles = Array.from(
    { length: Math.max(1, totalBimestres - bimestreActual + 1) },
    (_, i) => bimestreActual + i,
  );
  const defaultCourse =
    cursos.find((course) => course.nombre === activeUser.especialidad)?.nombre ??
    cursos[0]?.nombre ??
    activeUser.especialidad;
  const [tab, setTab] = useState<EvidenceTab>("nota");
  const [selectedCourse, setSelectedCourse] = useState<string>(defaultCourse);
  const [studentId, setStudentId] = useState(
    () => estudiantes[0]?.alumno.id_matricula ?? "",
  );
  const [selectedBimestre, setSelectedBimestre] = useState<BimestreCodigo>(() =>
    bimestreACodigo(bimestreActual),
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evaluationType, setEvaluationType] = useState<TipoEvaluacion>("Practica");
  const [grade, setGrade] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<EstadoAsistencia>("Presente");
  const [observationType, setObservationType] = useState<TipoObservacion>("Leve");
  const [comment, setComment] = useState("");
  const [referToTutor, setReferToTutor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string; levelRaised?: boolean; riesgoMsg?: string } | null>(null);

  const NIVEL_ORDER: Record<string, number> = { Bajo: 0, Medio: 1, Alto: 2 };

  /**
   * Ejecuta la acción de guardado (async), compara el riesgo antes/después
   * y muestra el aviso correspondiente con el nombre del alumno y los niveles.
   */
  const saveEvidence = async (action: () => Promise<{ nivelAnterior: string | null; nivelNuevo: string; fueBackend: boolean } | null>) => {
    const beforeStudent = getEstudiantes().find(
      (student) => student.alumno.id_matricula === studentId,
    );
    if (!beforeStudent) {
      setFeedback({ type: "error", text: "Selecciona un estudiante válido." });
      return false;
    }

    const nivelLocalAntes = beforeStudent.riesgo.nivel;
    setSaving(true);
    try {
      const resultado = await action();
      if (!resultado) return false;

      const { nivelAnterior, nivelNuevo, fueBackend } = resultado;
      const nivelPrevio = nivelAnterior ?? nivelLocalAntes;
      const levelRaised = (NIVEL_ORDER[nivelNuevo] ?? 0) > (NIVEL_ORDER[nivelPrevio] ?? 0);

      if (levelRaised) notificarTutor();

      let riesgoMsg: string | undefined;
      if (nivelPrevio !== nivelNuevo) {
        riesgoMsg = `Riesgo de ${beforeStudent.alumno.nombre}: ${nivelPrevio} → ${nivelNuevo}`;
      }

      setFeedback({
        type: "success",
        text: fueBackend
          ? "Evidencia guardada y riesgo recalculado por el modelo ML."
          : "Evidencia guardada (estimación local; backend no disponible).",
        levelRaised,
        riesgoMsg,
      });
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la evidencia.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitGrade = async (event: FormEvent) => {
    event.preventDefault();
    const numericGrade = Number(grade);
    if (grade === "" || !Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > 20) {
      setFeedback({ type: "error", text: "La nota debe estar entre 0 y 20." });
      return;
    }

    const nivelAntes = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";

    const ok = await saveEvidence(async () => {
      const riesgoBackend = await registrarCalificacion(studentId, {
        fecha: date,
        curso: selectedCourse,
        bimestre: selectedBimestre,
        tipo_evaluacion: evaluationType,
        nota: numericGrade,
      });
      const nivelNuevo = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";
      return {
        nivelAnterior: riesgoBackend?.nivel_anterior ?? nivelAntes,
        nivelNuevo: riesgoBackend?.nivel ?? nivelNuevo,
        fueBackend: riesgoBackend !== null,
      };
    });

    if (ok) setGrade("");
  };

  const submitAttendance = async (event: FormEvent) => {
    event.preventDefault();
    const nivelAntes = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";

    await saveEvidence(async () => {
      const riesgoBackend = await registrarAsistencia(studentId, {
        fecha: date,
        estado: attendanceStatus,
        hora_ingreso: null,
        medio: "Manual",
      });
      const nivelNuevo = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";
      return {
        nivelAnterior: riesgoBackend?.nivel_anterior ?? nivelAntes,
        nivelNuevo: riesgoBackend?.nivel ?? nivelNuevo,
        fueBackend: riesgoBackend !== null,
      };
    });
  };

  const submitObservation = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) {
      setFeedback({ type: "error", text: "Escribe un comentario para la observación." });
      return;
    }
    const derivationMotives: Partial<Record<TipoObservacion, string>> = {
      Leve: "Conducta leve reiterada",
      Grave: "Conducta grave que requiere seguimiento",
      Socioemocional: "Señal socioemocional que requiere acompañamiento",
    };
    const nivelAntes = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";

    const ok = await saveEvidence(async () => {
      const riesgoBackend = await registrarObservacion(studentId, {
        fecha: date,
        tipo: observationType,
        deriva_a_tutor: referToTutor,
        comentario: comment.trim(),
      });
      if (referToTutor) {
        crearDerivacion(studentId, {
          fecha: date,
          curso: selectedCourse,
          motivo: derivationMotives[observationType] ?? "Conducta",
          estado: "Pendiente",
          fecha_revision: null,
          accion_tutor: "",
          docente: activeUser.nombre,
          comentario: comment.trim(),
        });
      }
      const nivelNuevo = getEstudiantes().find((s) => s.alumno.id_matricula === studentId)?.riesgo.nivel ?? "Bajo";
      return {
        nivelAnterior: riesgoBackend?.nivel_anterior ?? nivelAntes,
        nivelNuevo: riesgoBackend?.nivel ?? nivelNuevo,
        fueBackend: riesgoBackend !== null,
      };
    });

    if (ok) {
      setComment("");
      setReferToTutor(false);
    }
  };

  return (
    <>
      <PageHeading title="Registrar evidencias" subtitle="La información registrada apoyará la revisión del tutor." />
      <section className="card evidence-card">
        <div className="evidence-tabs" role="tablist" aria-label="Tipo de evidencia">
          {([
            ["nota", "Nota"],
            ["asistencia", "Asistencia"],
            ["observacion", "Observación de conducta"],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setFeedback(null);
              }}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="evidence-form-wrap">
          <StudentCombobox
            estudiantes={estudiantes}
            value={studentId}
            onChange={(nuevoId) => setStudentId(nuevoId)}
          />

          {tab === "nota" && (
            <form className="evidence-form" onSubmit={submitGrade}>
              <label className="form-field">
                <span>Curso</span>
                <select
                  value={selectedCourse}
                  onChange={(event) => setSelectedCourse(event.target.value)}
                >
                  {cursos.map((course) => (
                    <option key={course.id} value={course.nombre}>
                      {course.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Bimestre</span>
                <select
                  value={selectedBimestre}
                  onChange={(event) => setSelectedBimestre(event.target.value as BimestreCodigo)}
                >
                  {bimestresDisponibles.map((bim) => {
                    const code = bimestreACodigo(bim);
                    return (
                      <option key={code} value={code}>
                        {bim}.º Bimestre{bim === bimestreActual ? " (actual)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="form-field"><span>Tipo de evaluación</span><select value={evaluationType} onChange={(event) => setEvaluationType(event.target.value as TipoEvaluacion)}><option value="Practica">Práctica</option><option>Simulacro</option><option>Examen</option></select></label>
              <label className="form-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="form-field"><span>Nota</span><input type="number" min="0" max="20" step="0.1" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="0–20" required /></label>
              <div className="evidence-submit"><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar nota"}</Button></div>
            </form>
          )}

          {tab === "asistencia" && (
            <form className="evidence-form" onSubmit={submitAttendance}>
              <label className="form-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="form-field"><span>Estado</span><select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as EstadoAsistencia)}><option>Presente</option><option>Tardanza</option><option>Falta justificada</option><option>Falta injustificada</option></select></label>
              <label className="form-field"><span>Medio</span><input value="Manual" readOnly /></label>
              <div className="evidence-submit"><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar asistencia"}</Button></div>
            </form>
          )}

          {tab === "observacion" && (
            <form className="evidence-form observation-form" onSubmit={submitObservation}>
              <label className="form-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="form-field"><span>Tipo</span><select value={observationType} onChange={(event) => {
                const nextType = event.target.value as TipoObservacion;
                setObservationType(nextType);
                if (nextType === "Positiva") setReferToTutor(false);
              }}><option>Positiva</option><option>Leve</option><option>Grave</option><option>Socioemocional</option></select></label>
              <label className="form-field full-field"><span>Comentario</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Describe la evidencia de manera objetiva y respetuosa." required /></label>
              <label className={`derive-check ${observationType === "Positiva" ? "disabled" : ""}`}><input type="checkbox" checked={referToTutor} disabled={observationType === "Positiva"} onChange={(event) => setReferToTutor(event.target.checked)} /><span>Derivar al tutor</span></label>
              <div className="evidence-submit"><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar observación"}</Button></div>
            </form>
          )}

          {feedback && (
            <div className={`evidence-feedback feedback-${feedback.type}`} role="status">
              <Icon name={feedback.type === "success" ? "check" : "info"} size={18} />
              <div>
                <strong>{feedback.text}</strong>
                {feedback.riesgoMsg && (
                  <p style={{ marginTop: "0.25rem", fontWeight: 600 }}>
                    ⚠️ {feedback.riesgoMsg}
                  </p>
                )}
                {feedback.levelRaised && !feedback.riesgoMsg && (
                  <p>Esta evidencia fue considerada; el tutor revisará el caso.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function TeacherDerivations({ activeUser }: { activeUser: Usuario }) {
  const { estudiantes } = useDataStore();
  const derivations = estudiantes
    .flatMap((student) =>
      student.derivaciones
        .filter((derivation) => derivation.docente === activeUser.nombre)
        .map((derivation) => ({ ...derivation, student: student.alumno.nombre })),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <PageHeading title="Mis derivaciones" subtitle="Consulta el estado y las acciones de acompañamiento registradas." />
      <section className="card teacher-derivations">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Motivo</th><th>Estado</th><th>Acción del tutor</th></tr></thead>
            <tbody>
              {derivations.map((derivation) => (
                <tr key={derivation.id}>
                  <td>{derivation.fecha}</td>
                  <td><strong>{derivation.student}</strong></td>
                  <td>{derivation.motivo}</td>
                  <td><span className={`derivation-status status-${derivation.estado.toLowerCase()}`}>{derivation.estado}</span></td>
                  <td>{derivation.accion_tutor || "Pendiente de registro"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function ModelAndData() {
  const { modelo } = useDataStore();
  const flowIcons: IconName[] = ["students", "calendar", "model", "alerts", "check"];
  const formatPercent = (value: number) =>
    `${(value * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
  const screenData = [
    ["Dashboard", "Matrícula, estudiante, riesgo y derivaciones docentes"],
    ["Estudiantes", "Estudiante, matrícula, calificaciones, asistencia y riesgo"],
    ["Detalle de alerta", "Riesgo, observaciones, tutorías y derivaciones docentes"],
    ["Seguimiento", "Calificaciones, asistencia, riesgo, tutorías y observaciones"],
    ["Derivaciones", "Derivaciones docentes, docentes y tutorías"],
    ["Vistas del docente", "Estudiante, cursos, calificaciones, asistencia y observaciones"],
    ["Comunicación con familias", "Apoderado y contactos familiares"],
    ["Acciones sugeridas", "Riesgo, soluciones y tutorías"],
  ];

  return (
    <>
      <PageHeading title="Cómo funciona el sistema" subtitle="Una explicación sencilla del recorrido de la información y sus límites." />
      <section className="card model-data-card">
        <div className="card-header"><div><p className="section-label">Flujo del sistema</p><h2>De la evidencia a la decisión del tutor</h2></div></div>
        <div className="model-data-flow">
          {modelo.flujo.map((step, index) => (
            <div className="model-data-step" key={step}>
              <span><Icon name={flowIcons[index]} /></span>
              <small>Paso {index + 1}</small>
              <strong>{step}</strong>
              {index < modelo.flujo.length - 1 && <Icon name="chevron" size={17} />}
            </div>
          ))}
        </div>
      </section>
      <section className="model-data-grid">
        <article className="card model-metrics">
          <div className="card-header"><div><p className="section-label">Semáforo</p><h2>Qué significa cada nivel</h2></div></div>
          <div className="model-metric-list semaphore-meaning">
            <div><RiskBadge level="Bajo" /><span>Sin señales relevantes por ahora.</span></div>
            <div><RiskBadge level="Medio" /><span>Desde {formatPercent(modelo.umbrales.medio)}. Conviene observar y acompañar.</span></div>
            <div><RiskBadge level="Alto" /><span>Desde {formatPercent(modelo.umbrales.alto)}. Requiere revisión del tutor.</span></div>
          </div>
        </article>
        <article className="card model-limitations">
          <div className="card-header"><div><p className="section-label">Alcance</p><h2>Limitaciones</h2></div></div>
          <ul>
            {modelo.limitaciones.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </article>
        <article className="card model-data-table">
          <div className="card-header"><div><p className="section-label">Trazabilidad</p><h2>Qué datos usa cada pantalla</h2></div></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Pantalla</th><th>Datos utilizados</th></tr></thead>
              <tbody>
                {screenData.map(([screen, sources]) => <tr key={screen}><td><strong>{screen}</strong></td><td>{sources}</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}

export function AccessDenied({ goBack }: { goBack: () => void }) {
  return (
    <section className="card access-denied" role="alert">
      <span className="access-denied-icon"><Icon name="info" /></span>
      <h1>No tienes acceso a esta vista</h1>
      <p>Esta sección no está disponible para el rol activo.</p>
      <Button onClick={goBack} icon="arrow">Volver</Button>
    </section>
  );
}