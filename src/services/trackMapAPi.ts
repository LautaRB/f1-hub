import type { DynamicTrackMap, DynamicTrackSectors, DynamicTrackTurn } from '../types/F1';

interface OpenF1Meeting {
  circuit_key: number;
  date_start: string;
}

interface OpenF1Session {
  session_key: number;
  year: number;
  date_start: string;
  date_end: string;
}

interface OpenF1Lap {
  driver_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
}

type ValidOpenF1Lap = {
  [K in keyof OpenF1Lap]: NonNullable<OpenF1Lap[K]>;
};

interface OpenF1Location {
  date: string;
  x: number;
  y: number;
}

interface MultiViewerCorner {
  number: number;
  letter?: string;
  trackPosition: { x: number; y: number };
}

interface MultiViewerCircuitResponse {
  x: number[];
  y: number[];
  rotation: number;
  corners: MultiViewerCorner[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openF1Fetch<T>(url: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) await sleep(500);
    }
  }
  return null;
}

async function resolveCircuitKey(year: string, raceDate: string): Promise<number | null> {
  const meetings = await openF1Fetch<OpenF1Meeting[]>(
    `https://api.openf1.org/v1/meetings?year=${year}`
  );
  if (!meetings?.length) return null;

  const targetMs = new Date(raceDate).getTime();
  const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

  const match = meetings.find((m) => {
    const meetingMs = new Date(m.date_start).getTime();
    return Math.abs(meetingMs - targetMs) <= SIX_DAYS_MS;
  });

  return match?.circuit_key ?? null;
}

function transformPoint(x: number, y: number, rotationDeg: number): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;

  return { x: rx, y: -ry };
}

function pointsToPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  return pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

function extractSectors(
  sortedLocs: Array<{ ms: number; x: number; y: number }>,
  t1: number,
  t2: number
): DynamicTrackSectors | undefined {
  const s1Pts = sortedLocs.filter((p) => p.ms <= t1);
  const s2Pts = sortedLocs.filter((p) => p.ms >= t1 && p.ms <= t2);
  const s3Pts = sortedLocs.filter((p) => p.ms >= t2);

  if (s1Pts.length && s2Pts.length) s1Pts.push(s2Pts[0]);
  if (s2Pts.length && s3Pts.length) s2Pts.push(s3Pts[0]);

  if (s1Pts.length > 2 && s2Pts.length > 2 && s3Pts.length > 2) {
    return {
      s1: pointsToPath(s1Pts),
      s2: pointsToPath(s2Pts),
      s3: pointsToPath(s3Pts),
    };
  }
  return undefined;
}

/**
 * Obtiene los Sectores (S1/S2/S3) reales a partir de la vuelta más rápida
 * de la última Qualifying finalizada en el circuito.
 */
async function getDynamicTrackSectors(
  circuitKey: number,
  rotation: number
): Promise<DynamicTrackSectors | undefined> {
  const sessions = await openF1Fetch<OpenF1Session[]>(
    `https://api.openf1.org/v1/sessions?circuit_key=${circuitKey}&session_name=Qualifying`
  );
  if (!sessions?.length) return undefined;

  const now = Date.now();
  const latestQuali = sessions
    .filter((s) => new Date(s.date_end).getTime() < now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0];

  if (!latestQuali) return undefined;

  const laps = await openF1Fetch<OpenF1Lap[]>(
    `https://api.openf1.org/v1/laps?session_key=${latestQuali.session_key}`
  );
  if (!laps?.length) return undefined;

  const fastestLap = laps
    .filter(
      (l): l is ValidOpenF1Lap =>
        l.date_start !== null &&
        l.lap_duration !== null &&
        l.duration_sector_1 !== null &&
        l.duration_sector_2 !== null &&
        l.duration_sector_3 !== null
    )
    .sort((a, b) => a.lap_duration - b.lap_duration)[0];

  if (!fastestLap) return undefined;

  const t0 = new Date(fastestLap.date_start).getTime();
  const t1 = t0 + fastestLap.duration_sector_1 * 1000;
  const t2 = t1 + fastestLap.duration_sector_2 * 1000;
  const t3 = t0 + fastestLap.lap_duration * 1000;

  const startIso = new Date(t0 - 500).toISOString();
  const endIso = new Date(t3 + 500).toISOString();

  const locations = await openF1Fetch<OpenF1Location[]>(
    `https://api.openf1.org/v1/location?session_key=${latestQuali.session_key}&driver_number=${fastestLap.driver_number}&date>=${startIso}&date<=${endIso}`
  );
  if (!locations || locations.length < 10) return undefined;

  const sortedLocs = locations
    .map((l) => ({
      ms: new Date(l.date).getTime(),
      ...transformPoint(l.x, l.y, rotation),
    }))
    .filter((l) => l.ms >= t0 && l.ms <= t3)
    .sort((a, b) => a.ms - b.ms);

  return extractSectors(sortedLocs, t1, t2);
}

export async function getDynamicTrackMap(
  season: string,
  raceDate: string
): Promise<DynamicTrackMap | null> {
  const circuitKey = await resolveCircuitKey(season, raceDate);
  if (!circuitKey) return null;

  const currentYear = Number(season);
  const yearsToTry = [currentYear, currentYear - 1];

  let data: MultiViewerCircuitResponse | null = null;

  for (const year of yearsToTry) {
    try {
      const res = await fetch(
        `https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${year}`,
        { headers: { 'User-Agent': 'F1Hub/1.0' } }
      );
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch {
      // Intenta con el siguiente año
    }
  }

  if (!data || !data.x?.length || !data.y?.length) return null;

  const rotation = data.rotation ?? 0;
  const points = data.x.map((x, i) => transformPoint(x, data.y[i], rotation));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = Math.max(width, height) * 0.1;

  const viewBox = [
    (minX - padding).toFixed(1),
    (minY - padding).toFixed(1),
    (width + padding * 2).toFixed(1),
    (height + padding * 2).toFixed(1),
  ].join(' ');

  const pathD = pointsToPath(points) + ' Z';

  const turns: DynamicTrackTurn[] = (data.corners ?? []).map((corner) => {
    const pt = transformPoint(corner.trackPosition.x, corner.trackPosition.y, rotation);
    return {
      label: `${corner.number}${corner.letter ?? ''}`,
      x: Number(pt.x.toFixed(1)),
      y: Number(pt.y.toFixed(1)),
    };
  });

  const sectors = await getDynamicTrackSectors(circuitKey, rotation);

  return {
    viewBox,
    pathD,
    turns,
    sectors,
    source: 'multiviewer',
  };
}