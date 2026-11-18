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

export interface LapRecord {
  time: string;
  driver: string;
  year: string;
}

export interface CircuitTelemetryConfig {
  circuitId: string;
  fullName: string;
  length: string;
  laps: number;
  topSpeed?: string;
  drsZones: number;
  lapRecord?: LapRecord;
  svgPath?: string;
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