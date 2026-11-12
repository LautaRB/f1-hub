export interface SessionSchedule {
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ssZ (UTC)
  isMain?: boolean;
}

export interface OvertakeZone {
  id: string;
  turn: string;
  detectionPoint: string;
  activationPoint: string;
  severity: 'Alta' | 'Media' | 'Baja';
  details: string;
}

export interface CircuitSpecs {
  length: string;
  laps: number;
  distance: string;
  corners: number;
  topSpeed: string;
  lapRecord: {
    time: string;
    driver: string;
    year: number;
  };
}

export interface CircuitTelemetryConfig {
  circuitId: string;
  svgPath?: string; // Ruta al SVG en /public/circuits/ o path inline
  specs: CircuitSpecs;
  overtakeZones: OvertakeZone[];
}

export interface NextRaceData {
  season: string;
  round: string;
  raceName: string;
  circuit: {
    circuitId: string;
    circuitName: string;
    locality: string;
    country: string;
  };
  date: string;
  time: string;
  sessions: SessionSchedule[];
  telemetry?: CircuitTelemetryConfig;
}