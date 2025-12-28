import express from "express";
import fetch from "node-fetch";
import cors from "cors";
// import fs from "fs";
import mysql from "mysql2/promise";

const app = express();
const PORT = 3000;

app.use(cors());
app.get("/api/openaq", async (req, res) => {
  const { lat = 52.2297, lon = 21.0122, radius = 20000 } = req.query;
  const apiKey = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b'
  const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radius}&limit=100`;

  try {
    const [dbSensors] = await pool.query(
      "SELECT sensorId, parameterName, displayName, unit, locationsId FROM openaq_sensors");

    const response = await fetch(url, {
       method: "GET",
       headers: {
         "X-API-Key": apiKey,
       },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const locations = data.results || [];

    const AQcoordinates = [];

    for (const loc of locations) {
      const latestUrl = `https://api.openaq.org/v3/locations/${loc.id}/latest`;

      const latestResponse = await fetch(latestUrl, {
        headers: { "X-API-Key": apiKey }
      });

      if (!latestResponse.ok) {
        throw new Error(`API error: ${latestResponse.status}`);
      }

      const latestData = await latestResponse.json();
      console.log("TO LATEST", latestData)
      //CZĘŚĆ POMIAROWA----------------------------------------------------------

      const measurements = latestData.results.map(m => {
        const sensor = (dbSensors.find(s => Number(s.sensorId) === Number(m.sensorsId) && Number(s.locationsId) === Number(m.locationsId)))
        return {
          name: sensor?.parameterName,
          sensorId: m.sensorsId,
          value: m.value,
          unit: sensor?.unit,
          time: m.datetime.local
        }
      })

      AQcoordinates.push({
        id: loc.id,
        lat: loc.coordinates.latitude,
        lon: loc.coordinates.longitude,
        station_name: loc.name,
        source: "openaq",
        measurements
      });
    }

    res.json(AQcoordinates);

  } catch (err) {
    console.error("Error downloading the data:", err);
    res.status(500).json({ error: "Error downloading the data" });
  }
});

app.get("/api/gios", async (req, res) => {
  let airCoordinates = [];
  let stations = []

  try {
    [stations] = await pool.query(
      "SELECT station_id, name, lat, lon, city, street FROM gios_stations"
    );

    airCoordinates = stations.map((loc) => ({
      id: loc.station_id,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name || "Data from gios",
      origin: loc.origin,
      source: "gios"
    }));

    const detailedStations = await Promise.all(airCoordinates.map(async station => {
      try {
        const response = await fetch(`https://api.gios.gov.pl/pjp-api/v1/rest/station/sensors/${station.id}`)

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        // console.log("stacje", response)
        const data = await response.json();
        const sensors = data["Lista stanowisk pomiarowych dla podanej stacji"] || [];

        let measurements = [];

        for (const sensor of sensors) {
          const sensorId = sensor["Identyfikator stanowiska"]
          const sensorResponse = await fetch(`https://api.gios.gov.pl/pjp-api/v1/rest/data/getData/${sensorId}`)
          if (!sensorResponse.ok) {
            throw new Error(`API error: ${sensorResponse.status} ${sensorResponse.statusText}`);
          }
          // console.log("sensory", sensorResponse)
          const sensorData = await sensorResponse.json();
          const sensorMeasures = sensorData["Lista danych pomiarowych"] || [];

          const recentMeasure = sensorMeasures[0]
          if (recentMeasure) {
            measurements.push(
              {
                // sensor: sensor["Kod wskaźnika"],
                name: sensor["Wskaźnik - wzór"],
                time: recentMeasure["Data"],
                value: recentMeasure["Wartość"]
              }
            )
          }
        }

        return {
          ...station,
          measurements,
          source: 'gios'
        }

      } catch (err) {
        console.error(err);
        return {
          ...station,
          measurements: [],
          source: "gios"
        };
      }
    }))
    return res.json(detailedStations);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "GIOS error" });
  }
})

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "haslo",
  database: "airly",
  // waitForConnections: true,
  // connectionLimit: 5,
  // queueLimit: 0
});

app.get("/api/airly", async (req, res) => {
  let airCoordinates = [];
  let stations = []

  try {
    [stations] = await pool.query(
        "SELECT id, name, lat, lon, city, street, origin FROM airly_stations"
      );

    airCoordinates = stations.map((loc) => ({
      id: loc.id,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name || "Data from Airly",
      origin: loc.origin,
      source: "airly"
    }));

    const [lastMeasurement] = await pool.query(
      `Select timestamp from airly_measurements
      order by timestamp desc
      limit 1`
    )

    const last = lastMeasurement[0]

    if (last && (Date.now() - new Date(last.timestamp).getTime()) < 3600 * 1000) {
      const [cached] = await pool.query(
        `select station_id AS id, aqi, params, timestamp from airly_measurements`
      );

      const cacheMap = new Map(
        cached.map(row => [
          row.id,
          {
            aqi: row.aqi,
            params:
              typeof row.params === "string"
                ? JSON.parse(row.params)
                : row.params,
            timestamp: row.timestamp
          }
        ])
      );

      const merged = airCoordinates.map(station => {
        const c = cacheMap.get(station.id);
        return {
          ...station,
          aqi: c?.aqi ?? null,
          measurements: c?.params ?? null,
          time: c?.timestamp ?? null,
          source: "airly (saved)"
        };
      });

      return res.json(merged);

    }
  } catch (err) {
    console.error("DB error:", err);
    return res.status(500).json({ error: "Database error" });
  }

  const detailedStations = await Promise.all(airCoordinates.map(async station=> {
    try {
      const url = `https://airapi.airly.eu/v2/measurements/point?lat=${station.lat}&lng=${station.lon}`;
      const data = await fetch(url, {
        headers: {
          Accept: "application/json",
          apikey: "f0TvSUUT3FrlEWD4jowv1TPXq51astfE"
        }
      });
      const json = await data.json();
      // console.log(json)

      if (!json.current) {
        throw new Error("Airly error");
      }

      const current = json.current || {};

      const result = {
        ...station,
        measurements: current.values.map(v => ({
          name: v.name,
          value: v.value,
          time: current.tillDateTime
        })),
        aqi: current.indexes[0].value ?? null
      }

      await pool.query(
       `REPLACE INTO airly_measurements (station_id, aqi, params, timestamp) values (?, ?, ?, now())`,
          [
            station.id,
            result.aqi,
            JSON.stringify(result.measurements)
          ]
      );

      return result

    } catch (err) {
      console.error("Detail fetch error for station:", station.id, err);
      return {
            ...station,
            measurements: null,
            aqi: null
      };
    }
  }));
  res.json(detailedStations);
})

app.get("/api/warsawIoT", async (req, res) => {
  const apiKey = "85f54f85-d58b-443d-a121-0081f9451fa3";
  const url = `https://api.um.warszawa.pl/api/action/air_sensors_get/?apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Warsaw API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // console.log("RAW data keys:", Object.keys(data));
    // console.log("RAW sample:", JSON.stringify(data).substring(0, 300));
    const WARcoordinates = data.result?.map(loc => ({
      id: loc.id,
      lat: parseFloat(loc.lat),
      lon: parseFloat(loc.lon),
      name: loc.name,
      stationType: loc.station_type,
      measurements: loc.data.map(p => ({
        paramName: p.param_name,
        name: p.param_code,
        value: p.value,
        unit: p.unit,
        time: p.time
      })),
      source: "warsawIoT"
    }))

    res.json(WARcoordinates);

  } catch (err) {
    console.error("Error downloading the data:", err);
    res.status(500).json({error: "Error downloading the data"});
  }
})

app.get("/api/aqicn", async (req, res) => {
  const apiKey = "ca09e110edc3446687444ae2b99bd6f278c12815";
  const keyword = "warsaw";

  let stations = [];

  try {
    const resp = await fetch(
      `https://api.waqi.info/search/?keyword=${keyword}&token=${apiKey}`
    );

    const json = await resp.json();

    if (json.status !== "ok") {
      throw new Error("AQICN error");
    }

    stations = json.data.map(s => ({
      id: s.uid,
      name: s.station.name,
      lat: s.station.geo[0],
      lon: s.station.geo[1],
      aqi: s.aqi,
      source: "aqicn"
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AQICN fetch error" });
  }


  const detailedStations = await Promise.all(stations.map(async station=> {
    try {
      const url = `https://api.waqi.info/feed/geo:${station.lat};${station.lon}/?token=${apiKey}`;
      const data = await fetch(url);
      const json = await data.json();

      if (json.status !== "ok") {
        throw new Error("AQICN error");
      }

      const iaqi = json.data.iaqi || {};
      return {
        ...station,
        measurements: {
          co: iaqi.co?.v ?? null,
          no2: iaqi.no2?.v ?? null,
          o3: iaqi.o3?.v ?? null,
          pm10: iaqi.pm10?.v ?? null,
          pm25: iaqi.pm25?.v ?? null,
        }
      }

    } catch (err) {
      console.error("Detail fetch error for station:", station.id, err);
        // return {...station, details: null};
    }
  }));
  res.json(detailedStations);
});

// app.get("/api/openaq/measurements", async (req, res) => {
//   const { id } = req.query;
//   const apiKey = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b';
//   if (!id) return res.status(400).json({ error: "Missing id" });
//
//   const url = `https://api.openaq.org/v3/locations/${id}/latest`;
//
//   try {
//     const [sensors] = await pool.query(
//       "SELECT sensorId, parameterName, displayName, unit, locationsId FROM openaq_sensors");
//
//     const response = await fetch(url, {
//       headers: { "X-API-Key": apiKey }
//     });
//
//     const json = await response.json();
//     if (!json.results || !Array.isArray(json.results)) {
//       return res.json([]);
//     }
//
//     const measurements = json.results.map(m => {
//       const sensor = sensors.find(s => Number(s.sensorId) === Number(m.sensorsId) && Number(s.locationsId) === Number(m.locationsId));
//
//       return {
//         displayName: sensor?.displayName || sensor?.parameterName || "Unknown",
//         sensorId: m.sensorsId,
//         value: m.value,
//         unit: sensor?.unit || "",
//         date: m.datetime.local
//       }
//     });
//
//     res.json(measurements);
//
//   } catch (err) {
//     console.error(err);
//     res.json([])
//   }
// });

app.listen(PORT, () => {
  console.log(`Proxy works on http://localhost:${PORT}`);
});
