import type { NextRaceData, SessionSchedule, CircuitTelemetryConfig } from '../types/F1';
import { getCircuitSpecs } from '../config/circuitData';
import { getLatestCircuitSvg } from '../config/circuitSvgMap';
import { getDynamicTrackMap } from './trackMapAPi';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

let cachedNextRace: { data: NextRaceData; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos en memoria

async function fetchJolpica(url: string, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'F1Hub/1.0 (Astro)',
        'Accept': 'application/json',
      },
    });

    if (res.ok) return res;

    if ((res.status === 403 || res.status === 429) && attempt < retries) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }

    throw new Error(`HTTP Error: ${res.status}`);
  }

  throw new Error('HTTP Error: Max retries reached');
}

const telemetryCache = new Map<string, { data: CircuitTelemetryConfig; expiresAt: number }>();

export async function getCircuitTelemetry(
  circuitId: string,
  season?: string,
  raceDate?: string,
  fallbackSvgPath?: string | null
): Promise<CircuitTelemetryConfig> {
  const cacheKey = `${circuitId}-${season ?? 'historic'}-${raceDate ?? ''}`;
  const cached = telemetryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const specs = getCircuitSpecs(circuitId);
  const dynamicMap =
    season && raceDate ? await getDynamicTrackMap(season, raceDate) : null;

  const telemetry: CircuitTelemetryConfig = {
    ...specs,
    circuitId,
    svgPath: getLatestCircuitSvg(circuitId) || fallbackSvgPath || '',
    dynamicMap: dynamicMap ?? undefined,
  };

  telemetryCache.set(cacheKey, {
    data: telemetry,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return telemetry;
}

export async function getNextRaceData(): Promise<NextRaceData | null> {
  if (cachedNextRace && Date.now() < cachedNextRace.expiresAt) {
    return cachedNextRace.data;
  }
  
  try {
    const res = await fetchJolpica('https://api.jolpi.ca/ergast/f1/current/next.json');
    const data = await res.json();

    const race = data.MRData.RaceTable.Races[0];
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
    const telemetry = await getCircuitTelemetry(circuitId, race.season, race.date);

    const result: NextRaceData = {
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      circuit: {
        circuitId,
        circuitName: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
        coordinates: {
          lat: Number(race.Circuit.Location.lat),
          lon: Number(race.Circuit.Location.long),
        },
      },
      date: race.date,
      time: race.time || '14:00:00Z',
      sessions,
      telemetry,
    };

    cachedNextRace = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return result;
  } catch (error) {
    console.error('Error obteniendo próxima carrera:', error);
    return cachedNextRace?.data ?? null;
  }
}

/**
 * Convierte fecha (YYYY-MM-DD) y hora UTC (HH:mm:ssZ) a hora de Argentina (GMT-3)
 * Ejemplo de salida: "Jue 19/11 · 21:30"
 */
export function formatSessionToArgTime(dateStr: string, timeStr: string): string {
  const iso = `${dateStr}T${timeStr.endsWith('Z') ? timeStr : `${timeStr}Z`}`;
  const date = new Date(iso);

  const formatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const rawWeekday = get('weekday').replace('.', '');
  const weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
  const day = get('day');
  const month = get('month');
  const hour = get('hour');
  const minute = get('minute');

  return `${weekday} ${day}/${month} · ${hour}:${minute}`;
}

export interface SeasonCircuit {
  round: number;
  season: string;
  raceName: string;
  date: string;
  time: string;
  hasSprint: boolean;
  status: 'completed' | 'next' | 'upcoming';
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

let cachedCircuits: { data: SeasonCircuit[]; expiresAt: number } | null = null;

export async function getSeasonCircuits(): Promise<SeasonCircuit[]> {
  if (cachedCircuits && Date.now() < cachedCircuits.expiresAt) {
    return cachedCircuits.data;
  }

  try {
    const response = await fetchJolpica('https://api.jolpi.ca/ergast/f1/current.json');
    const data = await response.json();
    const races = data?.MRData?.RaceTable?.Races ?? [];

    const now = Date.now();
    let nextAssigned = false;

    const circuits: SeasonCircuit[] = races.map((race: any) => {
      const raceTime = race.time || '14:00:00Z';
      const raceTimestamp = new Date(`${race.date}T${raceTime}`).getTime();
      // Se considera disputada si ya pasaron más de 4 horas desde la largada
      const isCompleted = raceTimestamp + 4 * 60 * 60 * 1000 < now;

      let status: SeasonCircuit['status'] = 'upcoming';
      if (isCompleted) {
        status = 'completed';
      } else if (!nextAssigned) {
        status = 'next';
        nextAssigned = true;
      }

      return {
        round: Number(race.round),
        season: race.season,
        raceName: race.raceName,
        date: race.date,
        time: raceTime,
        hasSprint: Boolean(race.Sprint),
        status,
        circuitId: race.Circuit.circuitId,
        circuitName: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
        coordinates: {
          lat: Number(race.Circuit.Location.lat),
          lon: Number(race.Circuit.Location.long),
        },
      };
    });

    cachedCircuits = {
      data: circuits,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return circuits;
  } catch (error) {
    console.error('Error obteniendo circuitos de la temporada:', error);
    return cachedCircuits?.data ?? [];
  }
}

interface JolpicaCircuitRaw {
  circuitId: string;
  url: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface CircuitItem {
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  wikiUrl: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  svgPath: string | null;
  inCurrentSeason: boolean;
  seasonData?: {
    round: number;
    season: string;
    raceName: string;
    date: string;
    time: string;
    hasSprint: boolean;
    status: 'completed' | 'next' | 'upcoming';
  };
}

let cachedAllCircuits: { data: CircuitItem[]; expiresAt: number } | null = null;

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function getLocalCircuitSvgs(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), 'public', 'circuits');
    const files = await readdir(dir);
    return files.filter((f) => f.toLowerCase().endsWith('.svg'));
  } catch {
    return [];
  }
}

function findSvgForCircuit(circuit: JolpicaCircuitRaw, svgFiles: string[]): string | null {
  const candidates = [
    normalizeKey(circuit.circuitId),
    normalizeKey(circuit.Location.locality),
    normalizeKey(circuit.circuitName),
  ];

  for (const candidate of candidates) {
    const match = svgFiles.find((file) => {
      const base = normalizeKey(file.replace(/\.svg$/i, ''));
      return base === candidate || base.includes(candidate) || candidate.includes(base);
    });
    if (match) return `/circuits/${match}`;
  }

  return null;
}

export async function getAllCircuits(): Promise<CircuitItem[]> {
  if (cachedAllCircuits && Date.now() < cachedAllCircuits.expiresAt) {
    return cachedAllCircuits.data;
  }

  try {
    const [allRes, seasonCircuits, svgFiles] = await Promise.all([
      fetchJolpica('https://api.jolpi.ca/ergast/f1/circuits.json?limit=100'),
      getSeasonCircuits(),
      getLocalCircuitSvgs(),
    ]);

    const data = await allRes.json();
    const rawCircuits: JolpicaCircuitRaw[] = data?.MRData?.CircuitTable?.Circuits ?? [];
    const seasonMap = new Map(seasonCircuits.map((c) => [c.circuitId, c]));

    const items: CircuitItem[] = rawCircuits.map((raw) => {
      const current = seasonMap.get(raw.circuitId);

      return {
        circuitId: raw.circuitId,
        circuitName: raw.circuitName,
        locality: raw.Location.locality,
        country: raw.Location.country,
        wikiUrl: raw.url,
        coordinates: {
          lat: Number(raw.Location.lat),
          lon: Number(raw.Location.long),
        },
        svgPath: getLatestCircuitSvg(raw.circuitId) || findSvgForCircuit(raw, svgFiles),
        inCurrentSeason: Boolean(current),
        seasonData: current
          ? {
              round: current.round,
              season: current.season,
              raceName: current.raceName,
              date: current.date,
              time: current.time,
              hasSprint: current.hasSprint,
              status: current.status,
            }
          : undefined,
      };
    });

    items.sort((a, b) => {
      if (a.inCurrentSeason && b.inCurrentSeason) {
        return (a.seasonData?.round ?? 99) - (b.seasonData?.round ?? 99);
      }
      if (a.inCurrentSeason) return -1;
      if (b.inCurrentSeason) return 1;
      return a.circuitName.localeCompare(b.circuitName);
    });

    cachedAllCircuits = {
      data: items,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return items;
  } catch (error) {
    console.error('Error obteniendo catálogo completo de circuitos:', error);
    return cachedAllCircuits?.data ?? [];
  }
}