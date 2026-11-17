export interface RaceStatusBadge {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
  pulse: boolean;
}

export function getRaceStatus(raceDateStr?: string): RaceStatusBadge {
  if (!raceDateStr) {
    return {
      label: 'STANDBY',
      dotColor: 'bg-zinc-500',
      bgColor: 'bg-zinc-900',
      textColor: 'text-zinc-400',
      pulse: false,
    };
  }

  const today = new Date();
  const raceDate = new Date(raceDateStr);

  // Normalizar fechas a medianoche para comparar días exactos (Zona horaria local)
  const isTodayRace = 
    today.getFullYear() === raceDate.getFullYear() &&
    today.getMonth() === raceDate.getMonth() &&
    today.getDate() === raceDate.getDate();

  if (isTodayRace) {
    return {
      label: 'RACE DAY',
      dotColor: 'bg-orange-500',
      bgColor: 'bg-orange-500/10 border-orange-500/30',
      textColor: 'text-orange-400',
      pulse: true,
    };
  }

  // Si falta para la carrera
  return {
    label: 'NEXT GP',
    dotColor: 'bg-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    textColor: 'text-emerald-400',
    pulse: false,
  };
}