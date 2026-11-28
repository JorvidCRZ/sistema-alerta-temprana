import { getAccionesSugeridas, parsearFactoresRiesgo, type Estudiante, type Motivo } from "../data";

export function factorToReason(family: string): Motivo | null {
  const normalized = family.toLowerCase();
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
  const reasons: Motivo[] = [];

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
  if (normalized.includes("rendimiento")) return "Bajo rendimiento";
  if (normalized.includes("asistencia")) return "Inasistencias";
  if (normalized.includes("contexto")) return "Situación familiar";
  if (normalized.includes("conducta")) return "Conducta";
  if (normalized.includes("bienestar")) return "Socioemocional";
  if (normalized.includes("pension") || normalized.includes("pensión")) return "Pensiones";
  return family;
}

