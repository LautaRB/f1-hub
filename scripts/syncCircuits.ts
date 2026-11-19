import fs from 'node:fs/promises';
import path from 'node:path';

interface JolpicaResult {
  laps?: string;
  Driver: { givenName: string; familyName: string };
  FastestLap?: {
    rank?: string;
    Time?: { time: string };
  };
}

interface GitTreeItem {
  path: string;
  type: string;
}

const CIRCUITS_JSON_PATH = path.resolve('src/data/circuits.json');
const PUBLIC_CIRCUITS_DIR = path.resolve('public/circuits');

const JOLPICA_CALENDAR = 'https://api.jolpi.ca/ergast/f1/current.json';
const JOLPICA_LAST_RACE = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';
const SVG_REPO = 'MisterSix2295/f1-circuits-svg';

function timeToMs(timeStr: string): number {
  const [minPart, rest] = timeStr.split(':');
  const [secPart, msPart = '0'] = rest.split('.');
  return Number(minPart) * 60_000 + Number(secPart) * 1_000 + Number(msPart.padEnd(3, '0'));
}

/**
 * 1. Detecta circuitos nuevos en el calendario actual y los agrega a circuits.json
 */
async function syncNewCircuits(circuits: Record<string, any>): Promise<boolean> {
  const res = await fetch(JOLPICA_CALENDAR);
  if (!res.ok) return false;

  const json = await res.json();
  const races = json?.MRData?.RaceTable?.Races ?? [];
  let changed = false;

  for (const race of races) {
    const id: string = race.Circuit?.circuitId;
    const name: string = race.Circuit?.circuitName;
    if (!id || circuits[id]) continue;

    circuits[id] = {
      fullName: name || id,
      length: 'N/A',
      laps: 0,
      topSpeed: 'N/A',
      drsZones: 0,
    };
    console.log(`Nuevo circuito detectado y agregado a circuits.json: ${id} (${name})`);
    changed = true;
  }

  return changed;
}

/**
 * 2. Actualiza récord de vuelta (y cantidad de vueltas si faltaba) tras el último GP
 */
async function syncLastRaceRecord(circuits: Record<string, any>): Promise<boolean> {
  const res = await fetch(JOLPICA_LAST_RACE);
  if (!res.ok) throw new Error(`Error consultando Jolpica: HTTP ${res.status}`);

  const json = await res.json();
  const race = json?.MRData?.RaceTable?.Races?.[0];
  if (!race) return false;

  const circuitId: string = race.Circuit.circuitId;
  if (!circuits[circuitId]) return false;

  const results: JolpicaResult[] = race.Results ?? [];
  let changed = false;

  // Si es un circuito nuevo con laps en 0, tomamos las vueltas del ganador
  const winnerLaps = Number(results[0]?.laps ?? 0);
  if (circuits[circuitId].laps === 0 && winnerLaps > 0) {
    circuits[circuitId].laps = winnerLaps;
    changed = true;
  }

  const fastest = results.find((r) => r.FastestLap?.rank === '1');
  const newTime = fastest?.FastestLap?.Time?.time;
  if (!newTime) return changed;

  const currentRecord: string | undefined = circuits[circuitId].lapRecord?.time;

  if (!currentRecord || timeToMs(newTime) < timeToMs(currentRecord)) {
    const driverName = `${fastest.Driver.givenName} ${fastest.Driver.familyName}`;
    circuits[circuitId].lapRecord = {
      time: newTime,
      driver: driverName,
      year: race.season,
    };
    console.log(`Nuevo récord en ${circuitId}: ${newTime} (${driverName}, ${race.season})`);
    changed = true;
  }

  return changed;
}

/**
 * 3. Descarga cualquier SVG nuevo desde el repo de f1-circuits-svg
 */
async function syncSvgFiles(): Promise<void> {
  await fs.mkdir(PUBLIC_CIRCUITS_DIR, { recursive: true });
  const existing = new Set(await fs.readdir(PUBLIC_CIRCUITS_DIR));

  let branch = 'main';
  let treeData: { tree?: GitTreeItem[] } | null = null;

  for (const candidate of ['main', 'master']) {
    const res = await fetch(
      `https://api.github.com/repos/${SVG_REPO}/git/trees/${candidate}?recursive=1`,
      { headers: { 'User-Agent': 'F1Hub-Bot' } }
    );
    if (res.ok) {
      branch = candidate;
      treeData = await res.json();
      break;
    }
  }

  if (!treeData?.tree) {
    console.log('No se pudo leer el árbol de SVGs desde GitHub.');
    return;
  }

  const svgItems = treeData.tree.filter(
    (item) => item.type === 'blob' && item.path.endsWith('.svg')
  );

  let downloaded = 0;

  for (const item of svgItems) {
    const fileName = path.basename(item.path);
    if (existing.has(fileName)) continue;

    const rawUrl = `https://raw.githubusercontent.com/${SVG_REPO}/${branch}/${item.path}`;
    const svgRes = await fetch(rawUrl);
    if (!svgRes.ok) continue;

    const content = await svgRes.text();
    await fs.writeFile(path.join(PUBLIC_CIRCUITS_DIR, fileName), content, 'utf-8');
    existing.add(fileName);
    downloaded++;
    console.log(`Nuevo SVG descargado: ${fileName}`);
  }

  console.log(downloaded > 0 ? `Total SVGs nuevos: ${downloaded}` : 'SVGs locales al día.');
}

async function main() {
  const raw = await fs.readFile(CIRCUITS_JSON_PATH, 'utf-8');
  const circuits = JSON.parse(raw);

  const addedCircuits = await syncNewCircuits(circuits);
  const updatedRecord = await syncLastRaceRecord(circuits);

  if (addedCircuits || updatedRecord) {
    await fs.writeFile(CIRCUITS_JSON_PATH, JSON.stringify(circuits, null, 2) + '\n', 'utf-8');
  } else {
    console.log('Sin cambios en circuits.json.');
  }

  await syncSvgFiles();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});