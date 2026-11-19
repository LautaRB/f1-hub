import type { DynamicTrackMap, DynamicTrackTurn } from '../types/F1';

interface OpenF1Meeting {
  circuit_key: number;
  date_start: string;
  meeting_name: string;
}

interface MultiViewerCorner {
  number: number;
  letter?: string;
  trackPosition: {
    x: number;
    y: number;
  };
}

interface MultiViewerCircuitResponse {
  x: number[];
  y: number[];
  rotation: number;
  corners: MultiViewerCorner[];
}

/**
 * Busca el circuit_key en OpenF1 comparando la fecha del GP (±6 días).
 * Evita hardcodear IDs y funciona automáticamente con circuitos nuevos.
 */
async function resolveCircuitKey(year: string, raceDate: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.openf1.org/v1/meetings?year=${year}`);
    if (!res.ok) return null;

    const meetings: OpenF1Meeting[] = await res.json();
    const targetMs = new Date(raceDate).getTime();
    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

    const match = meetings.find((m) => {
      const meetingMs = new Date(m.date_start).getTime();
      return Math.abs(meetingMs - targetMs) <= SIX_DAYS_MS;
    });

    return match?.circuit_key ?? null;
  } catch (err) {
    console.error('Error resolviendo circuit_key en OpenF1:', err);
    return null;
  }
}

/**
 * Rota un punto cartesiano (Y hacia arriba) al ángulo oficial y lo pasa a coordenadas SVG (Y hacia abajo).
 */
function transformPoint(x: number, y: number, rotationDeg: number): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;

  return { x: rx, y: -ry };
}

/**
 * Obtiene el trazado y las curvas exactas desde MultiViewer API.
 * Si el año actual devuelve 404 (aún no publicado), intenta con el año anterior.
 */
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

  // 1. Transformar todos los puntos del trazado
  const points = data.x.map((x, i) => transformPoint(x, data.y[i], rotation));

  // 2. Calcular bounding box y padding para el viewBox
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

  // 3. Construir el string <path d="...">
  const pathD =
    points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  // 4. Transformar las coordenadas exactas de cada curva
  const turns: DynamicTrackTurn[] = (data.corners ?? []).map((corner) => {
    const pt = transformPoint(corner.trackPosition.x, corner.trackPosition.y, rotation);
    return {
      label: `${corner.number}${corner.letter ?? ''}`,
      x: Number(pt.x.toFixed(1)),
      y: Number(pt.y.toFixed(1)),
    };
  });

  return {
    viewBox,
    pathD,
    turns,
    source: 'multiviewer',
  };
}