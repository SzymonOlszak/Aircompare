export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const phi1 = lat1 * Math.PI / 180
  const phi2 = lat2 * Math.PI / 180

  const deltaPhi = (lat2 - lat1) * Math.PI / 180
  const deltaLambda = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(deltaPhi / 2.0) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2.0) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return c * R  //dystans w m
}

export function inversedWeightedInterpolation(allMarkers: any[], lat: number, lon: number, key: 'pm10' | 'pm25' | 'no2' | 'o3') {
  const s: number = 1;
  const p: number = 3;
  let numerator = 0;
  let denominator = 0;
  // const ranges = [3000, 10000, 20000]
  // for (const maxRange in ranges) {
    for (const m of allMarkers) {
      const d = haversine(lat, lon, m.lat, m.lon);
      // if (d > ranges[maxRange]) {continue}
        const r = Math.sqrt(d * d + s * s);
        const w = 1 / Math.pow(r, p);
        numerator += m.pollutants?.[key] * w;
        denominator += w;
    }
    if (numerator !== 0 && denominator !== 0) {
      return numerator/denominator
    }
  // }
  return null
}


