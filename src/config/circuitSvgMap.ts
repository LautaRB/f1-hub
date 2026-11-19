import fs from 'node:fs';
import path from 'node:path';

/**
 * Alias solo para los circuitos donde el circuitId de Jolpica
 * no coincide con el prefijo del archivo en f1-circuits-svg.
 */
const CIRCUIT_ALIASES: Record<string, string> = {
  albert_park: 'melbourne',
  americas: 'austin',
  bahrain: 'bahrain',
  baku: 'baku',
  catalunya: 'catalunya',
  hungaroring: 'hungaroring',
  imola: 'imola',
  interlagos: 'interlagos',
  jeddah: 'jeddah',
  losail: 'lusail',
  marina_bay: 'marina-bay',
  miami: 'miami',
  monaco: 'monaco',
  monza: 'monza',
  red_bull_ring: 'spielberg',
  rodriguez: 'mexico-city',
  shanghai: 'shanghai',
  silverstone: 'silverstone',
  spa: 'spa-francorchamps',
  suzuka: 'suzuka',
  vegas: 'las-vegas',
  villeneuve: 'montreal',
  yas_marina: 'yas-marina',
  zandvoort: 'zandvoort',
};

let cachedFiles: string[] | null = null;

function getLocalSvgFiles(): string[] {
  if (cachedFiles) return cachedFiles;
  const dir = path.join(process.cwd(), 'public', 'circuits');
  if (!fs.existsSync(dir)) return [];
  cachedFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));
  return cachedFiles;
}

/**
 * Devuelve la ruta pública del SVG más reciente para un circuitId.
 * Ejemplo: si existen "catalunya-5.svg" y "catalunya-6.svg", devuelve "/circuits/catalunya-6.svg".
 */
export function getLatestCircuitSvg(circuitId: string): string | undefined {
  const files = getLocalSvgFiles();
  const slug = (CIRCUIT_ALIASES[circuitId] ?? circuitId.replace(/_/g, '-')).toLowerCase();

  // Matchea "<slug>.svg" o "<slug>-<numero>.svg"
  const pattern = new RegExp(`^${slug}(?:-(\\d+))?\\.svg$`, 'i');

  const matches = files
    .map((file) => {
      const m = file.match(pattern);
      if (!m) return null;
      return { file, version: m[1] ? Number(m[1]) : 0 };
    })
    .filter((item): item is { file: string; version: number } => item !== null)
    .sort((a, b) => b.version - a.version);

  return matches[0] ? `/circuits/${matches[0].file}` : undefined;
}