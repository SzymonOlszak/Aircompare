import fetch from "node-fetch";
import mysql from "mysql2/promise";

const lat = 52.2297;
const lng = 21.0122;
const radius = 20;
const apiKey = "f0TvSUUT3FrlEWD4jowv1TPXq51astfE";
const maxResults = 30;

const opAQRadius = 20000;
const opAQapiKey = "67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b";
const opAQmaxResults = 200;

async function fetchAirlyStations() {
  try {
    const url = `https://airapi.airly.eu/v2/installations/nearest?lat=${lat}&lng=${lng}&maxDistanceKM=${radius}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // console.log("Airly data:", data);
    //
    // console.log("JUST A TEST:");
    // console.log(JSON.stringify(data.slice(0, 3), null, 2));

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO airly_stations (id, name, lat, lon, city, street, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of data) {
      const { id, address, location, sponsor } = item;
      await connection.execute(insertQuery, [
        id,
        address?.displayAddress1 || "Punkt Airly",
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

async function fetchOpenAQSensors () {
  try {
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lng}&radius=${opAQRadius}&limit=${opAQmaxResults}`;;
    const response = await fetch(url, {
      method: "GET",
      headers: {
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
      REPLACE INTO openaq_sensors (sensorId, parameterName, displayName, unit, locationsId)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const loc of data.results || []) {
      for (const sensor of loc.sensors || []) {
        await connection.execute(insertQuery, [
          sensor.id,
          sensor.parameter?.name || null,
          sensor.parameter?.displayName || null,
          sensor.parameter?.units || null,
          loc.id
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
    if (!firstResponse.ok) throw new Error("First page error");

    const firstData = await firstResponse.json();
      // console.log("to to", firstData)
    const totalPages = firstData.totalPages;  //Zawsze zwraca 15
    console.log("Total pages:", totalPages);
    await (sleep(60000))

    for (let page = 0; page < totalPages; page++) {
      const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();

      const stations = data["Lista stacji pomiarowych"] || [];
      console.log("STACJE",`${page}`, stations);
      allStations.push(...stations);
      await (sleep(30000))
    }

    const giosCoordinates = allStations
      .filter(s => Number(s["Identyfikator miasta"]) === 1006)
      .map(s => ({
        id: s["Identyfikator stacji"],
        name: s["Nazwa stacji"],
        lat: parseFloat(s["WGS84 φ N"].replace(",", ".")),
        lon: parseFloat(s["WGS84 λ E"].replace(",", ".")),
        city: s["Nazwa miasta"],
        street: s["Ulica"] || null,
        province: s["Województwo"] || null,
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
          loc?.name || null,
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
// fetchAirlyStations()
// fetchOpenAQSensors()
// fetchGiosStations()

async function openaqTEST() {
  try {
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lng}&radius=${opAQRadius}&limit=${opAQmaxResults}`;

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
    console.log("OpenAQ data:", JSON.stringify(DATA.results?.slice(0, 3), null, 2));
  } catch (err) {
    console.log(err)
  }
}

// openaqTEST()
