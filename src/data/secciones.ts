import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

export interface SeccionInfo {
  id_seccion: number;
  grado: number;
  letra: string;
  codigo: string; // "3A"
  tutor: string | null;
  total_estudiantes: number;
}

// Se pide una sola vez al backend y se comparte entre todas las pantallas
let cache: Promise<[SeccionInfo[], Record<string, string>]> | null = null;

function cargarSecciones() {
  if (!cache) {
    cache = Promise.all([
      fetch(`${API}/secciones`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/matriculas-seccion`).then((r) => (r.ok ? r.json() : {})),
    ]).catch(() => {
      cache = null; // si falla (backend apagado), permite reintentar
      return [[], {}] as [SeccionInfo[], Record<string, string>];
    });
  }
  return cache;
}

export function useSecciones() {
  const [secciones, setSecciones] = useState<SeccionInfo[]>([]);
  const [porMatricula, setPorMatricula] = useState<Record<string, string>>({});

  useEffect(() => {
    let activo = true;
    cargarSecciones().then(([s, m]) => {
      if (!activo) return;
      setSecciones(s);
      setPorMatricula(m);
    });
    return () => {
      activo = false;
    };
  }, []);

  // Acepta "EST-2037", "2037" o 2037 y devuelve "3C"
  const seccionDe = (idMatricula: string | number): string | undefined => {
    const digitos = String(idMatricula).replace(/\D/g, "");
    return porMatricula[String(Number(digitos))];
  };

  return { secciones, seccionDe };
}

export function etiquetaSeccion(codigo?: string) {
  if (!codigo) return "Sección sin asignar";
  return `${codigo.slice(0, -1)}.º Sec. · ${codigo.slice(-1)}`;
}
