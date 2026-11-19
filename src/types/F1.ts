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

export interface TrackSegment {
  start: number; // Porcentaje de inicio (0 a 100)
  end: number;   // Porcentaje de fin (0 a 100)
}

export interface TrackTurn {
  number: number; // Número de curva
  pos: number;    // Posición porcentual sobre el trazado (0 a 100)
  dx?: number;    // Desplazamiento opcional en X para despegar el badge de la línea
  dy?: number;    // Desplazamiento opcional en Y
}

export interface DynamicTrackTurn {
  label: string; // Ej: "1", "14", "14A"
  x: number;
  y: number;
}

export interface TrackMapTelemetry {
  sectors?: {
    s1: TrackSegment;
    s2: TrackSegment;
    s3: TrackSegment;
  };
  drsSegments?: TrackSegment[];
  turns?: TrackTurn[];
}

export interface DynamicTrackMap {
  viewBox: string;
  pathD: string;
  turns: DynamicTrackTurn[];
  source: 'multiviewer' | 'local';
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
  mapTelemetry?: TrackMapTelemetry;
  dynamicMap?: DynamicTrackMap;
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