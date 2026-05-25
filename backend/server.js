import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());
app.get("/api/openaq", async (req, res) => {
  // const { lat = 52.2297, lon = 21.0122, radius = 20000 } = req.query;
  const lat = 52.2297;
  const lon = 21.0122;
  const radius = 20000;
  const apiKey = process.env.OPENAQ_API_KEY;
  const AQcoordinates = [];

  try {
    const [dbSensors] = await pool.query(
      "select sensorId, parameterName, unit, locationsId, lat, lon from openaq_sensors");

    const uniqueLocations = [...new Set (dbSensors.map(s => Number(s.locationsId)))];

    for (const locationId of uniqueLocations) {
      const latestUrl = `https://api.openaq.org/v3/locations/${locationId}/latest`;

      const latestResponse = await fetch(latestUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": apiKey
        },
      });

      if (!latestResponse.ok) {
        throw new Error(`API error: ${latestResponse.status} ${response.statusText}}`);
      }
      const latestData = await latestResponse.json();

      const measurements = latestData.results.map(m => {
        const sensor = (dbSensors.find(s => (s.sensorId) === Number(m.sensorsId) && Number(s.locationsId) === Number(m.locationsId)))
        return {
          name: sensor.parameterName,
          sensorId: m.sensorsId,
          value: Math.round(m.value * 100) / 100,
          unit: sensor.unit,
          time: m.datetime.local
        }
      })

      const sensorsForLocation = dbSensors.filter(s => Number(s.locationsId) === locationId);
      const lat = sensorsForLocation[0].lat;
      const lon = sensorsForLocation[0].lon;
      const name =  sensorsForLocation[0].name;

      AQcoordinates.push({
        id: locationId,
        lat: lat,
        lon: lon,
        station_name: name,
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
      "select station_id, name, lat, lon, city from gios_stations"
    );

    airCoordinates = stations.map((loc) => ({
      id: loc.station_id,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name || "Data from gios",
      city: loc.city,
      street: loc.street
    }));

    const detailedStations = await Promise.all(airCoordinates.map(async station => {
      try {
        const url = `https://api.gios.gov.pl/pjp-api/v1/rest/station/sensors/${station.id}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const sensors = data["Lista stanowisk pomiarowych dla podanej stacji"] || [];

        let measurements = [];

        for (const sensor of sensors) {
          const sensorId = sensor["Identyfikator stanowiska"]
          const url = `https://api.gios.gov.pl/pjp-api/v1/rest/data/getData/${sensorId}`
          const sensorResponse = await fetch(url)

          if (!sensorResponse.ok) {
            console.warn(`No data for sensor ${sensorId}`);
            continue;
          }

          const sensorData = await sensorResponse.json();
          const sensorMeasures = sensorData["Lista danych pomiarowych"] || [];

          const recentMeasure = sensorMeasures[0]
          measurements.push({
            name: sensor["Wskaźnik - wzór"],
            time: recentMeasure["Data"],
            value: recentMeasure["Wartość"]
          })
        }

        return {
          ...station,
          measurements,
          source: 'gios'
        }

      } catch (err) {
        console.error("Detail fetch error for station:", station.id, err);
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
});

app.get("/api/airly", async (req, res) => {
  let airCoordinates = [];
  let stations = []

  try {
    [stations] = await pool.query(
        "select locationId, name, lat, lon, city, street, origin from airly_stations"
    );

    airCoordinates = stations.map((loc) => ({
      id: loc.locationId,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name || "Data from Airly",
      origin: loc.origin,
      source: "airly"
    }));

    const [lastMeasurement] = await pool.query(
      `select timestamp from airly_measurements
      order by timestamp desc
      limit 1`
    )

    const last = lastMeasurement[0]

    if (last && (Date.now() - new Date(last.timestamp).getTime()) < 3600 * 1000) {
      const [cached] = await pool.query(
        `select station_id AS id, aqi, params, timestamp from airly_measurements`
      );

      const measurementsMap = new Map(
        cached.map(row => [
          row.id,
          {
            aqi: row.aqi,
            params: row.params,
            timestamp: row.timestamp
          }
        ])
      );

      const merged = airCoordinates.map(station => {
        const c = measurementsMap.get(station.id);
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
      const url = `https://airapi.airly.eu/v2/measurements/location?locationId=${station.id}`;
      const response = await fetch(url, {
        headers: {
          method: "GET",
          apikey: process.env.AIRLY_API_KEY
        }
      });
      if (!response.ok) {
        throw new Error(`Airly error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const current = data.current || {};

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
       `replace into airly_measurements (station_id, aqi, params, timestamp) values (?, ?, ?, now())`,
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
  const apiKey = process.env.WARSAWIOT_API_KEY;
  const url = `https://api.um.warszawa.pl/api/action/air_sensors_get/?apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Warsaw API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const warCoordinates = data.result?.map(loc => ({
      id: loc.zip_code,
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

    res.json(warCoordinates);

  } catch (err) {
    console.error("Error downloading the data:", err);
    res.status(500).json({error: "warsawIoT fetch error"});
  }
})

app.get("/api/aqicn", async (req, res) => {
  const apiKey = process.env.AQICN_API_KEY;
  const keyword = "mazowieckie";

  let stations = [];

  try {
    const url = `https://api.waqi.info/search/?keyword=${keyword}&token=${apiKey}`
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`AQICN error, ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    stations = data.data.map(s => ({
      id: s.uid,
      time: s.time,
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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("AQICN error");
      }
      const data = await response.json();

      const iaqi = data.data.iaqi || {};
      let pm25 = null;

      if (iaqi.pm25?.v && iaqi.pm10?.v) {
        if (iaqi.pm25.v !== parseFloat(station.aqi) && iaqi.pm25.v < iaqi.pm10.v * 1.3) {
          pm25 = iaqi.pm25.v;
        }
      }

      return {
        ...station,
        measurements: {
          co: iaqi.co?.v ?? null,
          so2: iaqi.so2?.v ?? null,
          no2: iaqi.no2?.v ?? null,
          o3: iaqi.o3?.v ?? null,
          pm10: iaqi.pm10?.v ?? null,
          pm25: pm25,
        }
      }

    } catch (err) {
       console.error("Detail fetch error for station:", station.id, err);
    }
  }));
  res.json(detailedStations);
});

app.get("/api/wind", async(req, res) =>{
  let windDetails = {}
  const apiKey = process.env.GOOGLEAPIS_API_KEY;

  try {
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=52.2297&location.longitude=21.0122&units_system=METRIC`

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json()

    windDetails = {
      direction: data.wind.direction.degrees,
      speed: data.wind.speed.value * 1000 / 3600,
    }

    res.json(windDetails);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Google wind fetch error" });
  }

})
app.listen(PORT, () => {
  console.log(`Proxy works on http://localhost:${PORT}`);
});
