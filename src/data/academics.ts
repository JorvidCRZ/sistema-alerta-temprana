import type { BimestreCodigo, BimestreNumero, Calificacion, TipoEvaluacion } from "./types";

export const PESOS_EVALUACION: Record<TipoEvaluacion, number> = {
  Practica: 0.3,
  Simulacro: 0.2,
  Examen: 0.5,
};

export interface ResultadoCursoPonderado {
  practica: number | null;
  simulacro: number | null;
  examen: number | null;
  promedio: number | null;
  esParcial: boolean;
}

export function redondearNota(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export function bimestreACodigo(bimestre: number): BimestreCodigo {
  if (bimestre <= 1) return "B1";
  if (bimestre === 2) return "B2";
  if (bimestre === 3) return "B3";
  return "B4";
}

export function codigoABimestre(codigo: BimestreCodigo): BimestreNumero {
  if (codigo === "B1") return 1;
  if (codigo === "B2") return 2;
  if (codigo === "B3") return 3;
  return 4;
}

/**
 * Calcula el promedio ponderado (30% Práctica, 20% Simulacro, 50% Examen)
 * de un curso en un bimestre.
 * - Si hay varias notas del mismo tipo, primero las promedia.
 * - Si falta algún tipo, lo omite (no cuenta como 0) y repondera los pesos presentes,
 *   marcando `esParcial = true`.
 */
export function calcularPromedioCursoPonderado(
  calificaciones: Calificacion[],
  curso: string,
  bimestre: BimestreCodigo,
): ResultadoCursoPonderado {
  const filtradas = calificaciones.filter(
    (c) => c.curso === curso && c.bimestre === bimestre,
  );

  const promediarTipo = (tipo: TipoEvaluacion): number | null => {
    const notas = filtradas.filter((c) => c.tipo_evaluacion === tipo).map((c) => c.nota);
    if (notas.length === 0) return null;
    const suma = notas.reduce((acc, n) => acc + n, 0);
    return redondearNota(suma / notas.length);
  };

  const practica = promediarTipo("Practica");
  const simulacro = promediarTipo("Simulacro");
  const examen = promediarTipo("Examen");

  const componentes: Array<{ nota: number | null; peso: number }> = [
    { nota: practica, peso: PESOS_EVALUACION.Practica },
    { nota: simulacro, peso: PESOS_EVALUACION.Simulacro },
    { nota: examen, peso: PESOS_EVALUACION.Examen },
  ];

  let sumaPonderada = 0;
  let pesoTotal = 0;
  for (const comp of componentes) {
    if (comp.nota !== null) {
      sumaPonderada += comp.nota * comp.peso;
      pesoTotal += comp.peso;
    }
  }

  if (pesoTotal === 0) {
    return {
      practica: null,
      simulacro: null,
      examen: null,
      promedio: null,
      esParcial: false,
    };
  }

  return {
    practica,
    simulacro,
    examen,
    promedio: redondearNota(sumaPonderada / pesoTotal),
    esParcial: pesoTotal < 0.999,
  };
}

/**
 * Calcula el promedio general del alumno en un bimestre como el promedio
 * de los promedios ponderados de sus cursos que tienen al menos una evaluación.
 */
export function calcularPromedioGeneral(
  calificaciones: Calificacion[],
  cursos: string[],
  bimestre: BimestreCodigo,
): { promedio: number | null; esParcial: boolean; cursosConNota: number } {
  const resultados = cursos
    .map((curso) => calcularPromedioCursoPonderado(calificaciones, curso, bimestre))
    .filter((r) => r.promedio !== null);

  if (resultados.length === 0) {
    return { promedio: null, esParcial: false, cursosConNota: 0 };
  }

  const suma = resultados.reduce((acc, r) => acc + (r.promedio ?? 0), 0);
  return {
    promedio: redondearNota(suma / resultados.length),
    esParcial: resultados.some((r) => r.esParcial),
    cursosConNota: resultados.length,
  };
}
