import type { NextRaceData, SessionSchedule } from '../types/F1';
import { getCircuitSpecs } from '../config/circuitData';
import { CIRCUIT_SVG_MAP } from '../config/circuitSvgMap';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

export async function getNextRaceData(): Promise<NextRaceData | null> {
  try {
    const res = await fetch(`${BASE_URL}/current/next.json`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const json = await res.json();
    const race = json?.MRData?.RaceTable?.Races?.[0];
    if (!race) return null;

    const sessions: SessionSchedule[] = [];

    if (race.FirstPractice) sessions.push({ name: 'Práctica 1', ...race.FirstPractice });
    if (race.SecondPractice) sessions.push({ name: 'Práctica 2', ...race.SecondPractice });
    if (race.ThirdPractice) sessions.push({ name: 'Práctica 3', ...race.ThirdPractice });
    if (race.SprintQualifying) sessions.push({ name: 'Sprint Qualy', ...race.SprintQualifying });
    if (race.Sprint) sessions.push({ name: 'Sprint', ...race.Sprint });
    if (race.Qualifying) sessions.push({ name: 'Clasificación', ...race.Qualifying });

    sessions.push({
      name: 'Carrera',
      date: race.date,
      time: race.time || '14:00:00Z',
      isMain: true,
    });

    const circuitId = race.Circuit.circuitId;
    
    // Busca datos técnicos del circuito en el JSON local
    const specs = getCircuitSpecs(circuitId);

    // 2. Arma el objeto telemetry con los datos del circuito y la ruta del SVG
    const telemetry = {
      ...specs,
      circuitId: circuitId,
      svgPath: CIRCUIT_SVG_MAP[circuitId] ? `/circuits/${CIRCUIT_SVG_MAP[circuitId]}` : undefined,
    };

    return {
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      circuit: {
        circuitId,
        circuitName: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
      },
      date: race.date,
      time: race.time || '14:00:00Z',
      sessions,
      telemetry,
    };
  } catch (error) {
    console.error('Error obteniendo próxima carrera:', error);
    return null;
  }
}

/**
 * Convierte fecha (YYYY-MM-DD) y hora UTC (HH:mm:ssZ) a la hora de Argentina (GMT-3)
 */
export function formatSessionToArgTime(dateStr: string, timeStr: string): string {
  const iso = `${dateStr}T${timeStr.endsWith('Z') ? timeStr : `${timeStr}Z`}`;
  const date = new Date(iso);

  const dayFormatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const timeFormatter = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  const day = dayFormatter.format(date).replace('.', '');
  const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
  return `${capitalizedDay} ${timeFormatter.format(date)}`;
}