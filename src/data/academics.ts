import type { BimestreKey, Calificacion, TipoEvaluacion } from "./types";
import { TIPOS_EVALUACION } from "./types";

export const PESOS_EVALUACION: Record<TipoEvaluacion, number> = {
  Practica: 0.3,
  Simulacro: 0.2,
  Examen: 0.5,
};

export const ETIQUETAS_EVALUACION: Record<TipoEvaluacion, string> = {
  Practica: "Práctica",
  Simulacro: "Simulacro",
  Examen: "Examen",
};

export interface PromedioCursoDetalle {
  curso: string;
  bimestre: number;
  evaluaciones: Record<TipoEvaluacion, number | null>;
  promedio: number | null;
  esParcial: boolean;
  faltantes: TipoEvaluacion[];
  tieneNotas: boolean;
}

export interface PromedioGeneralBimestre {
  bimestre: number;
  promedio: number | null;
  esParcial: boolean;
  cursosEvaluados: number;
}

export function redondearNota(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export function bimestreKey(bimestre: number): BimestreKey {
  const clamped = Math.min(4, Math.max(1, Math.round(bimestre)));
  return `B${clamped}` as BimestreKey;
}

export function normalizarBimestreNumero(bimestre: BimestreKey | number): number {
  if (typeof bimestre === "number") return bimestre;
  const parsed = Number(String(bimestre).replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 3;
}

export function obtenerBimestresDisponibles(
  bimestreActual: number,
  totalBimestres: number,
): number[] {
  const inicio = Math.max(1, Math.round(bimestreActual));
  const fin = Math.max(inicio, Math.round(totalBimestres));
  const lista: number[] = [];
  for (let b = inicio; b <= fin; b += 1) {
    lista.push(b);
  }
  return lista;
}

export function formatearBimestre(bimestre: number): string {
  return `${bimestre}.º bimestre`;
}

/**
 * Calcula el promedio ponderado de un curso en un bimestre:
 * Práctica 30 %, Simulacro 20 %, Examen 50 %.
 * Si hay varias notas del mismo tipo, primero las promedia.
 * Si falta algún tipo, repondera los pesos existentes y marca esParcial = true.
 */
export function calcularPromedioCurso(
  calificaciones: Calificacion[],
  curso: string,
  bimestre: number,
): PromedioCursoDetalle {
  const cursoNorm = curso.trim().toLowerCase();
  const notasCurso = calificaciones.filter(
    (c) =>
      c.curso.trim().toLowerCase() === cursoNorm &&
      normalizarBimestreNumero(c.bimestre) === bimestre,
  );

  const evaluaciones: Record<TipoEvaluacion, number | null> = {
    Practica: null,
    Simulacro: null,
    Examen: null,
  };
  const faltantes: TipoEvaluacion[] = [];

  let sumaPonderada = 0;
  let sumaPesos = 0;

  for (const tipo of TIPOS_EVALUACION) {
    const delTipo = notasCurso.filter((c) => c.tipo_evaluacion === tipo);
    if (delTipo.length === 0) {
      faltantes.push(tipo);
      continue;
    }
    const promedioTipo = redondearNota(
      delTipo.reduce((acc, item) => acc + item.nota, 0) / delTipo.length,
    );
    evaluaciones[tipo] = promedioTipo;
    const peso = PESOS_EVALUACION[tipo];
    sumaPonderada += promedioTipo * peso;
    sumaPesos += peso;
  }

  const tieneNotas = sumaPesos > 0;
  const promedio = tieneNotas ? redondearNota(sumaPonderada / sumaPesos) : null;
  const esParcial = tieneNotas && faltantes.length > 0;

  return {
    curso,
    bimestre,
    evaluaciones,
    promedio,
    esParcial,
    faltantes,
    tieneNotas,
  };
}

/**
 * Calcula el promedio general del alumno en un bimestre como el promedio
 * de los promedios ponderados de sus cursos con notas registradas.
 */
export function calcularPromedioGeneralBimestre(
  calificaciones: Calificacion[],
  cursos: string[],
  bimestre: number,
): PromedioGeneralBimestre {
  const nombres = new Set<string>(cursos);
  for (const c of calificaciones) {
    if (normalizarBimestreNumero(c.bimestre) === bimestre) {
      nombres.add(c.curso);
    }
  }

  const detalles = Array.from(nombres)
    .map((nombre) => calcularPromedioCurso(calificaciones, nombre, bimestre))
    .filter((d) => d.tieneNotas && d.promedio !== null);

  if (detalles.length === 0) {
    return {
      bimestre,
      promedio: null,
      esParcial: false,
      cursosEvaluados: 0,
    };
  }

  const promedio = redondearNota(
    detalles.reduce((acc, d) => acc + (d.promedio ?? 0), 0) / detalles.length,
  );
  const esParcial = detalles.some((d) => d.esParcial);

  return {
    bimestre,
    promedio,
    esParcial,
    cursosEvaluados: detalles.length,
  };
}
