import { useSyncExternalStore } from "react";
import cursosIniciales from "./cursos.json";
import estudiantesIniciales from "./datos_prototipo.json";
import docentesIniciales from "./docentes.json";
import modeloInicial from "./modelo.json";
import solucionesIniciales from "./soluciones.json";
import usuariosIniciales from "./usuarios.json";
import type {
  Calificacion,
  AccionSugerida,
  Contacto,
  Curso,
  Derivacion,
  Docente,
  EstadoDerivacion,
  Estudiante,
  FactorRiesgo,
  Motivo,
  ModeloInfo,
  NivelRiesgo,
  ObservacionConducta,
  RegistroAsistencia,
  RecalculoRiesgo,
  RiesgoEstimado,
  Solucion,
  Tutoria,
  Usuario,
} from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

interface DataState {
  estudiantes: Estudiante[];
  usuarios: Usuario[];
  docentes: Docente[];
  cursos: Curso[];
  soluciones: Solucion[];
  usuarioActivo: Usuario | null;
  recalculosRiesgo: Record<string, RecalculoRiesgo[]>;
  notificacionesTutor: number;
  modelo: ModeloInfo;
}

type EvidenciaSesion =
  | { tipo: "calificacion"; nota: number }
  | { tipo: "asistencia"; estado: RegistroAsistencia["estado"]; clave: string }
  | { tipo: "observacion"; observacion: ObservacionConducta["tipo"] };

const clone = <T,>(value: T): T => structuredClone(value);

function normalizarNivelRiesgo(nivelRaw: unknown, probabilidad: number): NivelRiesgo {
  const texto = String(nivelRaw ?? "").trim().toLowerCase();
  if (texto === "alto") return "Alto";
  if (texto === "medio") return "Medio";
  if (texto === "bajo") return "Bajo";
  if (probabilidad >= 0.65) return "Alto";
  if (probabilidad >= 0.35) return "Medio";
  return "Bajo";
}

function mapearEstudianteBackend(row: Record<string, unknown>, index: number): Estudiante {
  const idNum = Number(row.id_matricula ?? index + 1);
  const idMatricula = String(idNum);

  const nombreCompleto =
    String(
      row.nombre_completo ??
        row.nombre ??
        (`${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim() || `Estudiante ${idNum}`),
    ).trim();

  const codigo = String(
    row.codigo ?? row.codigo_estudiante ?? `EST-${String(idNum).padStart(4, "0")}`,
  );

  const promGeneral = Number(row.prom_b12 ?? row.promedio ?? 14);
  const b1 = Math.round(
    Number(row.prom_b1 ?? row.promedio_b1 ?? row.b1 ?? promGeneral),
  );
  const b2 = Math.round(
    Number(row.prom_b2 ?? row.promedio_b2 ?? row.b2 ?? promGeneral),
  );

  const inasistencias = Math.round(
    Number(row.total_faltas ?? row.inasistencias ?? 0),
  );

  const obsGraves = Math.round(Number(row.n_obs_graves ?? row.obs_graves ?? 0));
  const probabilidad = Math.min(0.99, Math.max(0.01, Number(row.probabilidad ?? 0.15)));
  const nivel = normalizarNivelRiesgo(row.nivel, probabilidad);

  const pesoAsistencia = Math.round(Math.min(45, inasistencias * 2 + 5));
  const pesoNotas = b2 < 12 ? 38 : b2 < b1 ? 24 : 10;
  const pesoConducta = obsGraves > 0 ? Math.min(35, obsGraves * 14) : 5;
  const factores = `Asistencia (${pesoAsistencia} puntos); Rendimiento académico (${pesoNotas} puntos); Conducta (${pesoConducta} puntos)`;

  const notasPorCurso = (cursosIniciales as Curso[]).map((curso, idx) => {
    const variacion = ((idNum + idx) % 3) - 1;
    return {
      curso: curso.nombre,
      B1: Math.min(20, Math.max(0, Math.round(b1 + variacion))),
      B2: Math.min(20, Math.max(0, Math.round(b2 + variacion))),
    };
  });

  const observacionesConducta: ObservacionConducta[] = Array.from(
    { length: Math.min(obsGraves, 5) },
    (_, i) => ({
      fecha: `2026-10-${String(10 + i * 4).padStart(2, "0")}`,
      tipo: "Grave",
      deriva_a_tutor: true,
      comentario: "Observación registrada en la base de datos académica.",
    }),
  );

  const asistenciaReciente: RegistroAsistencia[] = [
    {
      fecha: "2026-11-25",
      estado: inasistencias >= 4 ? "Falta injustificada" : "Presente",
      hora_ingreso: inasistencias >= 4 ? null : "07:42",
      medio: "Lector IoT",
    },
    {
      fecha: "2026-11-24",
      estado: inasistencias >= 2 ? "Tardanza" : "Presente",
      hora_ingreso: inasistencias >= 2 ? "08:06" : "07:38",
      medio: "Lector IoT",
    },
    {
      fecha: "2026-11-21",
      estado: "Presente",
      hora_ingreso: "07:40",
      medio: "Manual",
    },
  ];

  return {
    alumno: {
      id_matricula: idMatricula,
      nombre: nombreCompleto,
      codigo,
      promedios_bimestre: { B1: b1, B2: b2 },
      inasistencias,
      apoderado: {
        nombres: String(
          row.apoderado_nombres ?? row.nombre_apoderado ?? "Apoderado registrado",
        ),
        parentesco: String(row.apoderado_parentesco ?? "Apoderado"),
      },
    },
    riesgo: {
      probabilidad,
      nivel,
      factores,
    },
    observaciones_conducta: observacionesConducta,
    tutorias: [],
    derivaciones: [],
    asistencia_reciente: asistenciaReciente,
    notas_por_curso: notasPorCurso,
    calificaciones: [],
    contactos: [],
  };
}

const createInitialState = (): DataState => ({
  estudiantes: clone(estudiantesIniciales as Estudiante[]),
  usuarios: clone(usuariosIniciales as Usuario[]),
  docentes: clone(docentesIniciales as Docente[]),
  cursos: clone(cursosIniciales as Curso[]),
  soluciones: clone(solucionesIniciales as Solucion[]),
  usuarioActivo: null,
  recalculosRiesgo: {},
  notificacionesTutor: 0,
  modelo: clone(modeloInicial as ModeloInfo),
});

let state = createInitialState();
let evidenciasSesion = new Map<string, EvidenciaSesion[]>();
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export async function cargarEstudiantesDesdeBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/estudiantes?limit=200`);
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const estudiantesReales = data.map((row, index) =>
      mapearEstudianteBackend(row as Record<string, unknown>, index),
    );
    state = { ...state, estudiantes: estudiantesReales };
    emitChange();
  } catch {
    // Si el backend FastAPI está apagado, mantiene los datos de demostración
  }
}

if (typeof window !== "undefined") {
  void cargarEstudiantesDesdeBackend();
}

function updateEstudiante(idMatricula: string, updater: (estudiante: Estudiante) => Estudiante) {
  let encontrado = false;
  const estudiantes = state.estudiantes.map((estudiante) => {
    if (estudiante.alumno.id_matricula !== idMatricula) return estudiante;
    encontrado = true;
    return updater(estudiante);
  });

  if (!encontrado) throw new Error(`No existe un estudiante con matrícula ${idMatricula}.`);
  state = { ...state, estudiantes };
  emitChange();
}

function agregarEvidencia(idMatricula: string, evidencia: EvidenciaSesion) {
  const existentes = evidenciasSesion.get(idMatricula) ?? [];
  evidenciasSesion.set(idMatricula, [...existentes, evidencia]);
}

function agregarRecalculo(idMatricula: string, fecha: string) {
  const estudiante = state.estudiantes.find(
    (item) => item.alumno.id_matricula === idMatricula,
  );
  if (!estudiante) return;

  const estimacion = estimarRiesgoSimulado(estudiante);
  state = {
    ...state,
    recalculosRiesgo: {
      ...state.recalculosRiesgo,
      [idMatricula]: [
        ...(state.recalculosRiesgo[idMatricula] ?? []),
        { fecha, ...estimacion },
      ],
    },
  };
  emitChange();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDataState() {
  return state;
}

export function getEstudiantes() {
  return state.estudiantes;
}

// login de demostración; en producción el servidor valida con contraseñas cifradas
export function iniciarSesion(correo: string, clave: string) {
  const usuario = state.usuarios.find(
    (item) => item.correo.toLowerCase() === correo.trim().toLowerCase() && item.clave === clave,
  );
  if (!usuario) return null;
  state = { ...state, usuarioActivo: usuario };
  emitChange();
  return usuario;
}

export function cerrarSesion() {
  state = { ...state, usuarioActivo: null };
  emitChange();
}

export function registrarCalificacion(idMatricula: string, calificacion: Calificacion) {
  if (calificacion.nota < 0 || calificacion.nota > 20) {
    throw new RangeError("La nota debe estar entre 0 y 20.");
  }

  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    calificaciones: [...(estudiante.calificaciones ?? []), clone(calificacion)],
  }));
  agregarEvidencia(idMatricula, { tipo: "calificacion", nota: calificacion.nota });
  agregarRecalculo(idMatricula, calificacion.fecha);
}

export function registrarAsistencia(idMatricula: string, asistencia: RegistroAsistencia) {
  const estudiante = state.estudiantes.find(
    (item) => item.alumno.id_matricula === idMatricula,
  );
  if (estudiante?.asistencia_reciente.some((registro) => registro.fecha === asistencia.fecha)) {
    throw new Error("Ya existe una asistencia para este estudiante en la fecha seleccionada.");
  }

  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    alumno: {
      ...estudiante.alumno,
      inasistencias:
        estudiante.alumno.inasistencias +
        (asistencia.estado === "Falta justificada" ||
        asistencia.estado === "Falta injustificada"
          ? 1
          : 0),
    },
    asistencia_reciente: [...estudiante.asistencia_reciente, clone(asistencia)].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    ),
  }));

  const clave = `asistencia:${asistencia.fecha}`;
  const existentes = evidenciasSesion.get(idMatricula) ?? [];
  evidenciasSesion.set(idMatricula, [
    ...existentes.filter((evidencia) => evidencia.tipo !== "asistencia" || evidencia.clave !== clave),
    { tipo: "asistencia", estado: asistencia.estado, clave },
  ]);
  agregarRecalculo(idMatricula, asistencia.fecha);
}

export function registrarObservacion(idMatricula: string, observacion: ObservacionConducta) {
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    observaciones_conducta: [...estudiante.observaciones_conducta, clone(observacion)],
  }));
  agregarEvidencia(idMatricula, { tipo: "observacion", observacion: observacion.tipo });
  agregarRecalculo(idMatricula, observacion.fecha);
}

export function crearDerivacion(idMatricula: string, derivacion: Omit<Derivacion, "id">) {
  const id = `DER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nuevaDerivacion: Derivacion = { ...clone(derivacion), id };
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    derivaciones: [...estudiante.derivaciones, nuevaDerivacion],
  }));
  return nuevaDerivacion;
}

export function actualizarDerivacion(
  idMatricula: string,
  idDerivacion: string,
  cambios: Partial<
    Pick<
      Derivacion,
      | "estado"
      | "fecha_revision"
      | "accion_tutor"
      | "docente"
      | "derivacion_tutoria"
      | "nota_tutor"
      | "tutor"
    >
  > & {
    estado?: EstadoDerivacion;
  },
) {
  let encontrada = false;
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    derivaciones: estudiante.derivaciones.map((derivacion) => {
      if (derivacion.id !== idDerivacion) return derivacion;
      encontrada = true;
      return {
        ...derivacion,
        ...clone(cambios),
        cambio_estado:
          cambios.estado && cambios.estado !== derivacion.estado ? true : derivacion.cambio_estado,
      };
    }),
  }));
  if (!encontrada) throw new Error(`No existe la derivación ${idDerivacion}.`);
}

export function registrarTutoria(idMatricula: string, tutoria: Tutoria) {
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    tutorias: [...estudiante.tutorias, clone(tutoria)],
  }));
}

export function registrarContacto(idMatricula: string, contacto: Omit<Contacto, "id">) {
  const nuevoContacto: Contacto = {
    ...clone(contacto),
    id: `CON-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    contactos: [...(estudiante.contactos ?? []), nuevoContacto],
  }));
  return nuevoContacto;
}

export function actualizarRespuestaContacto(
  idMatricula: string,
  idContacto: string,
  respondio: boolean,
) {
  updateEstudiante(idMatricula, (estudiante) => ({
    ...estudiante,
    contactos: (estudiante.contactos ?? []).map((contacto) =>
      contacto.id === idContacto ? { ...contacto, respondio } : contacto,
    ),
  }));
}

export function getAccionesSugeridas(
  motivo: Motivo,
  historial: Tutoria[],
): AccionSugerida[] {
  const perfil = state.soluciones.find((solucion) => solucion.motivo === motivo);
  if (!perfil) return [];

  return perfil.acciones
    .map((accion) => ({
      ...accion,
      aplicaciones: historial.filter((tutoria) => tutoria.accion === accion.nombre),
    }))
    .sort((a, b) => b.pct_mejoro - a.pct_mejoro);
}

export function notificarTutor() {
  state = { ...state, notificacionesTutor: state.notificacionesTutor + 1 };
  emitChange();
}

export function parsearFactoresRiesgo(factores: string): FactorRiesgo[] {
  return factores
    .split("; ")
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => {
      const coincidencia = parte.match(/^(.+?)\s+\((-?\d+(?:[.,]\d+)?)\s+puntos?\)$/i);
      if (!coincidencia) return { familia: parte, valor: 0 };
      return {
        familia: coincidencia[1].trim(),
        valor: Number(coincidencia[2].replace(",", ".")),
      };
    });
}

export function estimarRiesgoSimulado(estudiante: Estudiante): RiesgoEstimado {
  const evidencias = evidenciasSesion.get(estudiante.alumno.id_matricula) ?? [];
  let probabilidad = estudiante.riesgo.probabilidad;

  evidencias.forEach((evidencia) => {
    if (evidencia.tipo === "calificacion") {
      if (evidencia.nota < 11) probabilidad += 0.05;
      else if (evidencia.nota >= 14) probabilidad -= 0.02;
    }

    if (evidencia.tipo === "asistencia") {
      if (evidencia.estado === "Falta injustificada") probabilidad += 0.03;
      if (evidencia.estado === "Falta justificada") probabilidad += 0.01;
      if (evidencia.estado === "Tardanza") probabilidad += 0.005;
    }

    if (evidencia.tipo === "observacion") {
      if (evidencia.observacion === "Grave") probabilidad += 0.05;
      if (evidencia.observacion === "Socioemocional") probabilidad += 0.04;
      if (evidencia.observacion === "Leve") probabilidad += 0.02;
      if (evidencia.observacion === "Positiva") probabilidad -= 0.02;
    }
  });

  probabilidad = Math.min(0.99, Math.max(0.01, probabilidad));
  const nivel =
    probabilidad >= state.modelo.umbrales.alto
      ? "Alto"
      : probabilidad >= state.modelo.umbrales.medio
        ? "Medio"
        : "Bajo";
  return { probabilidad, nivel };
}

export function restablecerDatosDemostracion() {
  const usuarioActivo = state.usuarioActivo;
  state = { ...createInitialState(), usuarioActivo };
  evidenciasSesion = new Map();
  emitChange();
  void cargarEstudiantesDesdeBackend();
}

export function useDataStore() {
  return useSyncExternalStore(subscribe, getDataState, getDataState);
}