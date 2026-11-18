import circuitsDB from '../data/circuits.json';

export interface LapRecord {
  time: string;
  driver: string;
  year: string;
}

export interface CircuitSpecs {
  fullName: string;
  length: string;
  laps: number;
  lapRecord?: LapRecord;
  drsZones: number;
}

// Casteo del JSON para que TypeScript lo reconozca como un Record<string, CircuitSpecs>
const CIRCUITS_TELEMETRY = circuitsDB as Record<string, CircuitSpecs>;

export const DEFAULT_TELEMETRY: CircuitSpecs = {
  fullName: "Datos no disponibles",
  length: "N/A",
  laps: 0,
  drsZones: 0
};

/**
 * Busca los specs técnicos de un circuito por su ID de Jolpica.
 * Si no existe en el JSON, devuelve el DEFAULT_TELEMETRY.
 */
export function getCircuitSpecs(circuitId: string): CircuitSpecs {
  return CIRCUITS_TELEMETRY[circuitId] || DEFAULT_TELEMETRY;
}