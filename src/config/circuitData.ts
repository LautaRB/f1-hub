import type { CircuitTelemetryConfig } from '../types/F1';

export const CIRCUITS_TELEMETRY: Record<string, CircuitTelemetryConfig> = {
  vegas: {
    circuitId: 'las-vegas-1',
    svgPath: '/circuits/las-vegas-1.svg',
    specs: {
      length: '6.201 km',
      laps: 50,
      distance: '309.958 km',
      corners: 17,
      topSpeed: '350 km/h',
      lapRecord: { time: '1:35.490', driver: 'O. Piastri', year: 2023 },
    },
    overtakeZones: [
      {
        id: 'OZ-1',
        turn: 'Curva 14 (Final de The Strip)',
        detectionPoint: 'Salida de Curva 12 (1.9 km a fondo)',
        activationPoint: '200m después de Curva 12',
        severity: 'Alta',
        details: 'Frenada extrema de 350 km/h a 90 km/h. Principal punto de sobrepaso del circuito.',
      },
      {
        id: 'OZ-2',
        turn: 'Curva 1 (Hairpin)',
        detectionPoint: 'Antes de Curva 16',
        activationPoint: 'Recta principal post Curva 17',
        severity: 'Media',
        details: 'Recta corta pero efectiva en largada, relanzamientos y batallas rueda a rueda.',
      },
    ],
  },
  lusail: {
    circuitId: 'lusail-1',
    svgPath: '/circuits/lusail-1.svg',
    specs: {
      length: '5.419 km',
      laps: 57,
      distance: '308.611 km',
      corners: 16,
      topSpeed: '335 km/h',
      lapRecord: { time: '1:24.319', driver: 'M. Verstappen', year: 2023 },
    },
    overtakeZones: [
      {
        id: 'OZ-1',
        turn: 'Curva 1 (Recta Principal)',
        detectionPoint: 'Antes de Curva 16',
        activationPoint: 'Recta principal (1.068 km)',
        severity: 'Alta',
        details: 'Única zona principal de adelantamiento antes de entrar en la secuencia de curvas rápidas.',
      },
    ],
  },
  yasmarina: {
    circuitId: 'yas_marina-1',
    svgPath: '/circuits/yas_marina-1.svg',
    specs: {
      length: '5.281 km',
      laps: 58,
      distance: '306.183 km',
      corners: 16,
      topSpeed: '340 km/h',
      lapRecord: { time: '1:26.103', driver: 'M. Verstappen', year: 2021 },
    },
    overtakeZones: [
      {
        id: 'OZ-1',
        turn: 'Curva 6 (Chicana tras recta larga)',
        detectionPoint: 'Antes de Curva 5 (Hairpin)',
        activationPoint: 'Salida de Curva 5 (1.2 km)',
        severity: 'Alta',
        details: 'Frenada fuerte tras la recta más larga del circuito.',
      },
      {
        id: 'OZ-2',
        turn: 'Curva 9 (Peraltada)',
        detectionPoint: 'Salida de Curva 7',
        activationPoint: 'Recta secundaria hacia Curva 9',
        severity: 'Alta',
        details: 'Permite recuperar la posición o defenderse inmediatamente después de la primera recta.',
      },
    ],
  },
};

export const DEFAULT_TELEMETRY: CircuitTelemetryConfig = {
  circuitId: 'default',
  specs: {
    length: '5.513 km',
    laps: 56,
    distance: '308.405 km',
    corners: 20,
    topSpeed: '332 km/h',
    lapRecord: { time: '1:36.169', driver: 'C. Leclerc', year: 2019 },
  },
  overtakeZones: [
    {
      id: 'OZ-1',
      turn: 'Curva 12 (Recta Opuesta)',
      detectionPoint: '150m antes de Curva 11',
      activationPoint: '250m después de Curva 11 (1.0 km)',
      severity: 'Alta',
      details: 'Zona principal de sobrepaso con frenada profunda al final de la recta larga.',
    },
    {
      id: 'OZ-2',
      turn: 'Curva 1 (Subida ciega)',
      detectionPoint: 'Entre Curvas 18 y 19',
      activationPoint: 'Recta principal de meta',
      severity: 'Media',
      details: 'Vértice ancho en subida que permite múltiples líneas de tracción.',
    },
  ],
};