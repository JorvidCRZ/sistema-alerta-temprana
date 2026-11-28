export const TIPOS_OBSERVACION = ["Positiva", "Leve", "Grave", "Socioemocional"] as const;
export const ESTADOS_ASISTENCIA = ["Presente", "Tardanza", "Falta justificada", "Falta injustificada"] as const;
export const MEDIOS_ASISTENCIA = ["Manual", "Lector IoT"] as const;
export const TIPOS_EVALUACION = ["Practica", "Simulacro", "Examen"] as const;
export const ESTADOS_DERIVACION = ["Pendiente", "Revisada", "Atendida"] as const;
export const ACCIONES_TUTORIA = [
  "Compromiso con el estudiante",
  "Citación al apoderado",
  "Plan de recuperación",
  "Seguimiento semanal",
  "Orientación",
] as const;
export const DERIVACIONES_TUTORIA = ["Ninguna", "Psicologia", "Coordinacion"] as const;
export const MOTIVOS = [
  "Bajo rendimiento",
  "Inasistencias",
  "Conducta",
  "Situación familiar",
  "Socioemocional",
  "Orientación vocacional",
] as const;
export const TIPOS_CONTACTO = ["Llamada", "Mensaje", "Citacion"] as const;

export type TipoObservacion = (typeof TIPOS_OBSERVACION)[number];
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];
export type MedioAsistencia = (typeof MEDIOS_ASISTENCIA)[number];
export type TipoEvaluacion = (typeof TIPOS_EVALUACION)[number];
export type EstadoDerivacion = (typeof ESTADOS_DERIVACION)[number];
export type AccionTutoria = (typeof ACCIONES_TUTORIA)[number];
export type DerivacionTutoria = (typeof DERIVACIONES_TUTORIA)[number];
export type Motivo = (typeof MOTIVOS)[number];
export type TipoContacto = (typeof TIPOS_CONTACTO)[number];
export type NivelRiesgo = "Bajo" | "Medio" | "Alto";
export type RolUsuario = "Tutor" | "Docente" | "Coordinacion";
export type BimestreKey = "B1" | "B2" | "B3" | "B4";

export interface Calificacion {
  fecha: string;
  curso: string;
  bimestre: BimestreKey;
  tipo_evaluacion: TipoEvaluacion;
  nota: number;
}

export interface RegistroAsistencia {
  fecha: string;
  estado: EstadoAsistencia;
  hora_ingreso: string | null;
  medio: MedioAsistencia;
}

export interface ObservacionConducta {
  fecha: string;
  tipo: TipoObservacion;
  deriva_a_tutor: boolean;
  comentario?: string;
}

export interface Tutoria {
  fecha: string;
  motivo: Motivo;
  accion: AccionTutoria;
  derivacion: DerivacionTutoria;
  mejoro_sim: boolean;
  nota?: string;
  tutor?: string;
}

export interface Derivacion {
  id: string;
  fecha: string;
  curso: string;
  motivo: string;
  estado: EstadoDerivacion;
  fecha_revision: string | null;
  accion_tutor: string;
  docente: string;
  cambio_estado?: boolean;
  comentario?: string;
  derivacion_tutoria?: DerivacionTutoria;
  nota_tutor?: string;
  tutor?: string;
}

export interface Contacto {
  id: string;
  fecha: string;
  tipo: TipoContacto;
  detalle: string;
  respondio: boolean;
  resumen_datos?: string;
}

export interface NotaPorCurso {
  curso: string;
  B1: number;
  B2: number;
  B3?: number | null;
  B4?: number | null;
}

export interface Seccion {
  id_seccion: number;
  grado: number;
  letra: string;
  codigo: string;
  tutor: string;
  total_estudiantes: number;
}

export interface Estudiante {
  alumno: {
    id_matricula: string;
    nombre: string;
    codigo: string;
    promedios_bimestre: { B1: number; B2: number; B3?: number | null; B4?: number | null };
    inasistencias: number;
    apoderado: { nombres: string; parentesco: string };
    grado?: number;
    letra?: string;
    seccion?: string;
  };
  riesgo: {
    probabilidad: number;
    nivel: NivelRiesgo;
    factores: string;
  };
  observaciones_conducta: ObservacionConducta[];
  tutorias: Tutoria[];
  derivaciones: Derivacion[];
  asistencia_reciente: RegistroAsistencia[];
  notas_por_curso: NotaPorCurso[];
  calificaciones?: Calificacion[];
  contactos?: Contacto[];
}

export interface Usuario {
  id: string;
  rol: RolUsuario;
  nombre: string;
  especialidad: string;
  correo: string;
  clave: string;
}

export interface Docente {
  id: string;
  usuario_id: string;
  grado: string;
  seccion: string;
}

export interface Curso {
  id: string;
  nombre: string;
}

export interface Solucion {
  motivo: Motivo;
  acciones: {
    nombre: AccionTutoria;
    pct_mejoro: number;
    n_casos: number;
    variacion_media: number;
  }[];
}

export interface AccionSugerida {
  nombre: AccionTutoria;
  pct_mejoro: number;
  n_casos: number;
  variacion_media: number;
  aplicaciones: Tutoria[];
}

export interface FactorRiesgo {
  familia: string;
  valor: number;
}

export interface RiesgoEstimado {
  probabilidad: number;
  nivel: NivelRiesgo;
}

export interface RecalculoRiesgo extends RiesgoEstimado {
  fecha: string;
}

export interface ModeloInfo {
  umbrales: {
    medio: number;
    alto: number;
  };
  metricas_alto: {
    recall: number;
    precision: number;
    f1: number;
  };
  flujo: string[];
  limitaciones: string[];
}
