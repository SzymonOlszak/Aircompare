export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const phi1 = lat1 * Math.PI / 180
  const phi2 = lat2 * Math.PI / 180

  const deltaPhi = (lat2 - lat1) * Math.PI / 180
  const deltaLambda = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(deltaPhi / 2.0) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2.0) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  // const d = c * R; tu był dystans w metrach
  return c * R
}


export function inversedWeightedInterpolation(allMarkers: any[], lat: number, lon: number) {
  const s: number = 0.5;
  const p: number = 1;
  let numerator = 0;
  let denominator = 0;
  for (const m of allMarkers) {
    if (!m.caqi == null) {continue}

    const d = haversine(lat, lon, m.lat, m.lon);
    const r = Math.sqrt(d * d + s * s);
    const w = 1 / Math.pow(r, p);

    numerator += m.caqi * w;
    denominator += w;
  }
  if (denominator === 0) {return null}
  return numerator/denominator
}
