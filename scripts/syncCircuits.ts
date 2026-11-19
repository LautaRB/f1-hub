import fs from 'node:fs/promises';
import path from 'node:path';

interface JolpicaResult {
  Driver: {
    givenName: string;
    familyName: string;
  };
  FastestLap?: {
    rank?: string;
    Time?: {
      time: string;
    };
  };
}

const CIRCUITS_PATH = path.resolve('src/data/circuits.json');
const JOLPICA_LAST_RACE = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';

function timeToMs(timeStr: string): number {
  const [minPart, rest] = timeStr.split(':');
  const [secPart, msPart = '0'] = rest.split('.');
  return Number(minPart) * 60_000 + Number(secPart) * 1_000 + Number(msPart.padEnd(3, '0'));
}

async function syncLapRecords() {
  const res = await fetch(JOLPICA_LAST_RACE);
  if (!res.ok) throw new Error(`Error consultando Jolpica: HTTP ${res.status}`);

  const json = await res.json();
  const race = json?.MRData?.RaceTable?.Races?.[0];

  if (!race) {
    console.log('No hay resultados disponibles todavía.');
    return;
  }

  const circuitId: string = race.Circuit.circuitId;
  const results: JolpicaResult[] = race.Results ?? [];
  const fastest = results.find((r) => r.FastestLap?.rank === '1');

  if (!fastest?.FastestLap?.Time?.time) {
    console.log(`No se encontró vuelta rápida registrada para ${circuitId}.`);
    return;
  }

  const newTime = fastest.FastestLap.Time.time;
  const driverName = `${fastest.Driver.givenName} ${fastest.Driver.familyName}`;
  const season: string = race.season;

  const raw = await fs.readFile(CIRCUITS_PATH, 'utf-8');
  const circuits = JSON.parse(raw);

  if (!circuits[circuitId]) {
    console.log(`El circuito "${circuitId}" no existe en circuits.json. Se omite.`);
    return;
  }

  const currentRecord: string | undefined = circuits[circuitId].lapRecord?.time;

  if (!currentRecord || timeToMs(newTime) < timeToMs(currentRecord)) {
    circuits[circuitId].lapRecord = {
      time: newTime,
      driver: driverName,
      year: season,
    };

    await fs.writeFile(CIRCUITS_PATH, JSON.stringify(circuits, null, 2) + '\n', 'utf-8');
    console.log(`Nuevo récord en ${circuitId}: ${newTime} (${driverName}, ${season})`);
  } else {
    console.log(`Sin cambios en ${circuitId}. Récord vigente: ${currentRecord} vs ${newTime}`);
  }
}

syncLapRecords().catch((err) => {
  console.error(err);
  process.exit(1);
});