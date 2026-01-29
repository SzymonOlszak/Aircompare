import fetch from "node-fetch";
import mysql from "mysql2/promise";

const lat = 52.2297;
const lng = 21.0122;
const radius = 30;
const apiKey = "f0TvSUUT3FrlEWD4jowv1TPXq51astfE";
const maxResults = 30;

async function fetchAirlyStations() {
  try {
    const url = `https://airapi.airly.eu/v2/installations/nearest?lat=${lat}&lng=${lng}&maxDistanceKM=${radius}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        method: "GET",
        Accept: "application/json",
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(data)

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO airly_stations (locationId, name, lat, lon, city, street, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of data) {
      const { locationId, address, location, sponsor } = item;
      await connection.execute(insertQuery, [
        locationId,
        address.displayAddress1,
        location.latitude,
        location.longitude,
        address?.city || "",
        address?.street || "",
        sponsor?.name || "",
      ]);
    }

    console.log("Data loaded to MySQL");
    await connection.end();

  } catch (err) {
      console.error("Error downloading the data:", err);
  }
}
fetchGiosStations()
// fetchOpenAQSensors()

async function fetchOpenAQSensors () {
  const opAQRadius = 20000;
  const opAQapiKey = "67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b";
  const opAQmaxResults = 200;
  try {
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lng}&radius=${opAQRadius}&limit=${opAQmaxResults}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": opAQapiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO openaq_sensors (sensorId, parameterName, displayName, unit, locationsId, name, lat, lon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const loc of data.results || []) {
      for (const sensor of loc.sensors || []) {
        await connection.execute(insertQuery, [
          sensor.id,
          sensor.parameter.name,
          sensor.parameter.displayName,
          sensor.parameter.units,
          loc.id,
          loc.name,
          loc.coordinates.latitude,
          loc.coordinates.longitude
        ]);
      }
    }
     console.log("OpenAQ sensors loaded to MySQL");
     await connection.end();

  } catch (err) {
    console.error("Error downloading the data:", err);
  }
}

async function fetchGiosStations() {
  let allStations = [];
  const url = "https://api.gios.gov.pl/pjp-api/v1/rest/station/findAll";
  const pageSize = 20;

  try {
    const firstResponse = await fetch(`${url}?page=0&size=${pageSize}`);
    if (!firstResponse.ok) {
      throw new Error("First page error");
    }

    const firstData = await firstResponse.json();
    const totalPages = firstData.totalPages;
    await (sleep(30000))

    for (let page = 0; page < totalPages; page++) {
      const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();

      const stations = data["Lista stacji pomiarowych"] || [];
      allStations.push(...stations);
      await (sleep(30000))
    }

    const identificators = [1006, 19, 259, 452, 662, 685, 1130, 395]
    const giosCoordinates = allStations
      .filter((s => identificators.includes(Number(s["Identyfikator miasta"]))))
      .map(s => ({
        id: s["Identyfikator stacji"],
        name: s["Nazwa stacji"],
        lat: parseFloat(s["WGS84 φ N"]),
        lon: parseFloat(s["WGS84 λ E"]),
        city: s["Nazwa miasta"],
        source: "gios",
      }));

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO gios_stations (
        station_id,
        name,
        lat,
        lon,
        city,
        street)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const loc of giosCoordinates || []) {
        await connection.execute(insertQuery, [
          loc.id,
          loc.name || null,
          loc.lat || null,
          loc.lon || null,
          loc.city || null,
          loc.street || null
        ]);
    }
    await connection.end();
  } catch (err) {
    console.error("Server error:", err);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function measurement() {
  try {
    const url = 'https://api.openaq.org/v3/sensors/36297/hours'
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": opAQapiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    const DATA = await response.json()
    console.log(JSON.stringify(DATA, null, 2))
  } catch (err) {
    console.log(err)
  }
}
// openaqTEST()
// measurement()
async function openaqTEST() {
  const lat = 52.2297;
  const lon = 21.0122;
  const radius = 20000;
  const apiKey = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b'
  const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radius}&limit=100`;

  try {

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
    console.log(data)
  } catch (err) {
    console.log(err)
  }
}
