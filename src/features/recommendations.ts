import { getAccionesSugeridas, parsearFactoresRiesgo, type Estudiante, type Motivo } from "../data";

export function factorToReason(family: string): Motivo | null {
  const normalized = family.toLowerCase();
  if (normalized.includes("rendimiento en b1 y b2")) return "Bajo rendimiento";
  if (normalized.includes("asistencia en b1 y b2")) return "Inasistencias";
  if (normalized.includes("conducta") && normalized.includes("tutoría")) return "Conducta";
  if (normalized.includes("contexto del alumno y la familia")) return "Situación familiar";
  if (normalized.includes("pensiones")) return "Situación familiar";
  if (normalized.includes("rendimiento")) return "Bajo rendimiento";
  if (normalized.includes("asistencia")) return "Inasistencias";
  if (normalized.includes("contexto del alumno y la familia") || normalized.includes("contexto familiar")) return "Situación familiar";
  if (normalized.includes("conducta")) return "Conducta";
  if (normalized.includes("bienestar")) return "Socioemocional";
  return null;
}

export function getStudentReasons(student: Estudiante): Motivo[] {
  const factors = [...parsearFactoresRiesgo(student.riesgo.factores)].sort(
    (a, b) => Math.abs(b.valor) - Math.abs(a.valor),
  );
  const dominantFactor = factors[0];
  const reasons: Motivo[] = [];
  const mainReason = dominantFactor ? factorToReason(dominantFactor.familia) : null;
  if (mainReason) reasons.push(mainReason);

  for (const factor of factors) {
    const reason = factorToReason(factor.familia);
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }

  // Mantiene el bienestar como motivo secundario si no aparece con peso suficiente.
  if (
    student.observaciones_conducta.some((observation) => observation.tipo === "Socioemocional") &&
    !reasons.includes("Socioemocional")
  ) {
    reasons.push("Socioemocional");
  }

  return reasons.slice(0, 2);
}

export function getTopRecommendation(student: Estudiante, reason = getStudentReasons(student)[0]) {
  if (!reason) return null;
  const actions = getAccionesSugeridas(reason, student.tutorias);
  return actions.find((action) => action.aplicaciones.length === 0) ?? actions[0] ?? null;
}

export function displayFactorFamily(family: string) {
  const normalized = family.toLowerCase();
  if (normalized.includes("rendimiento")) return "Rendimiento en Bimestre 1 y 2";
  if (normalized.includes("asistencia")) return "Asistencia en Bimestre 1 y 2";
  if (normalized.includes("contexto")) return "Situación del estudiante y su familia";
  if (normalized.includes("conducta")) return "Conducta y tutorías previas";
  if (normalized.includes("pension") || normalized.includes("pensión")) return "Pagos de pensión";
  if (normalized.includes("bienestar")) return "Bienestar del estudiante";
  return family;
}

