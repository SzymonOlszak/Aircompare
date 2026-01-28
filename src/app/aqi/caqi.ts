export const PM25Breakpoints = [
  { BPlow: 0,   BPhi: 15,  Ilow: 0,   Ihi: 25 },
  { BPlow: 15,  BPhi: 30,  Ilow: 25,  Ihi: 50 },
  { BPlow: 30,  BPhi: 55,  Ilow: 50,  Ihi: 75 },
  { BPlow: 55,  BPhi: 110, Ilow: 75,  Ihi: 100 },
  { BPlow: 110,  BPhi: Infinity, Ilow: 100,  Ihi: 100 },
];

export const PM10Breakpoints = [
  { BPlow: 0,   BPhi: 25,  Ilow: 0,   Ihi: 25 },
  { BPlow: 25,  BPhi: 50,  Ilow: 25,  Ihi: 50 },
  { BPlow: 50,  BPhi: 90,  Ilow: 50,  Ihi: 75 },
  { BPlow: 90,  BPhi: 180, Ilow: 75,  Ihi: 100 },
  { BPlow: 180,  BPhi: Infinity, Ilow: 100, Ihi: 100 },
];

export const NO2Breakpoints = [
  { BPlow: 0,   BPhi: 50,  Ilow: 0,   Ihi: 25 },
  { BPlow: 50,  BPhi: 100,  Ilow: 25,  Ihi: 50 },
  { BPlow: 100,  BPhi: 200,  Ilow: 50,  Ihi: 75 },
  { BPlow: 200,  BPhi: 400, Ilow: 75,  Ihi: 100 },
  { BPlow: 400,  BPhi: Infinity, Ilow: 100,  Ihi: 100 },
];

export const O3Breakpoints = [
  { BPlow: 0,   BPhi: 60,  Ilow: 0,   Ihi: 25 },
  { BPlow: 60,  BPhi: 120,  Ilow: 25,  Ihi: 50 },
  { BPlow: 120,  BPhi: 180,  Ilow: 50,  Ihi: 75 },
  { BPlow: 180,  BPhi: 240, Ilow: 75,  Ihi: 100 },
  { BPlow: 240,  BPhi: Infinity, Ilow: 100,  Ihi: 100 },
];


export function calculateCAQI(measure: number, breakpoints: Array<any>): number | null {
  const bp = breakpoints.find(b =>
    measure >= b.BPlow && measure < b.BPhi
  );
  if (!bp) return null;

  const { BPlow, BPhi, Ilow, Ihi } = bp;
  return ((Ihi - Ilow) / (BPhi - BPlow)) * (measure - BPlow) + Ilow;
}

export function calculateCAQIFromCell(cell: {pm10: number, pm25: number, no2: number, o3: number}) {
  return Math.max(
    calculateCAQI(cell.pm10, PM10Breakpoints) ?? 0,
    calculateCAQI(cell.pm25, PM25Breakpoints) ?? 0,
    calculateCAQI(cell.no2, NO2Breakpoints) ?? 0,
    calculateCAQI(cell.o3, O3Breakpoints) ?? 0
  );
}
