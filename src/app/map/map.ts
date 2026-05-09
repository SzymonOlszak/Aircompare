import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import {CommonModule} from '@angular/common';
import {calculateCAQI, calculateCAQIFromCell, PM25Breakpoints, O3Breakpoints, PM10Breakpoints, NO2Breakpoints} from '../aqi/caqi';
import {inversedWeightedInterpolation} from '../interpolation/interpolation';
import {getWindVector, runAdvectionDiffusion} from '../prediction/prediction'
import {min} from 'rxjs';
// export interface WindData {
//   direction: number;
//   speed: number;
// }

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})

export class Map implements OnInit {
  private map: any;
  private allData: any[] = [];
  private caqiMarkers: {
    lat: number;
    lon: number;
    caqi: number | null;
    sources: string[];
    pollutants: any;
  }[] = [];
  private allMarkers: {
    marker: L.Marker;
    sources: string[];
  }[] = []

  public windData?: {
    direction: number,
    speed: number
  };

  private windVector?: {
    u: number,
    v: number
  }

  private grid: {                        //interpolacja
    lat: number,
    lon: number,
    caqi: number}[] = []

  private predictionGrid!: {
    pm10: number,
    pm25: number,
    o3: number,
    no2: number } [][];

  private predictionGrids!: {
    pm10: number[][],
    pm25: number[][] ,
    o3: number[][],
    no2: number[][]};

  private halfHourPrediction: {
    lat: number,
    lon: number,
    caqi: number}[] = []

  private oneHourPrediction: {
    lat: number,
    lon: number,
    caqi: number}[] = []

  private twoHoursPrediction: {
    lat: number,
    lon: number,
    caqi: number}[] = []

  private caqiLayer = L.layerGroup();
  private interpolationLayer = L.layerGroup();
  private predictionLayer = L.layerGroup();
  private allSourcesLayer = L.layerGroup();

  public predictionViewStatus: 0.5 | 1 | 2 | null = null;
  private chosenSources: Record<string, boolean> = {
    gios: true,
    openaq: true,
    airly: true,
    'airly (saved)': true,
    aqicn: true,
    warsawIoT: true,
  }

  public viewMode: 'sources' | 'caqi' = 'sources';
  public interpolationViewMode : 'on' | 'off' = 'off';
  public predictionViewMode : 'on' | 'off' = 'off';
  public measurements: any[] = [];
  public stationTitle: string = "";

  async ngOnInit(): Promise <void> {
    this.runMap();

    this.addLayer();

    await Promise.all([
      this.getOpenAQ(),
      this.getGIOS(),
      this.getAirly(),
      this.getWarsawIoT(),
      this.getAQICN(),
      this.getWind()
    ]);

    this.addMarkers()
    if (this.windData) {
      this.windVector = getWindVector(this.windData.direction, this.windData.speed)
    }
    console.log("WIATER", this.windVector)

    const minLat = 51.95;
    const maxLat = 52.5;
    const minLon = 20.1;
    const maxLon = 21.8;
    const step = 0.01;
    const y = Math.floor((maxLat - minLat) / step);      //DLA OSI Y, ile przeskoków, LONGITUDE
    const x = Math.floor((maxLon - minLon) / step);      //DLA OSI X, ile przeskoków, LATITUDE
    console.log("skok x:", x, "skok y:", y)
    this.predictionGrids = {
      pm10: Array.from({ length: y }, () => Array(x).fill(0)),
      pm25: Array.from({ length: y }, () => Array(x).fill(0)),
      no2:  Array.from({ length: y }, () => Array(x).fill(0)),
      o3:   Array.from({ length: y }, () => Array(x).fill(0)),
    };
    this.runInterpolation(x,y, minLat, minLon, step)
    this.runPrediction(x,y, minLat, maxLat, minLon, step)

    // const bounds = this.map.getBounds();
    // const bounds = this.map.getBounds();
    // const minLat = bounds.getSouth();
    // const maxLat = bounds.getNorth();
    // const minLon = bounds.getWest();
    // const maxLon = bounds.getEast();

    let maxWind = 0;
    // const steps = 1000;



    console.log("TU JEST GRID", this.grid);
    console.log("TU DO PREDYKCJI?", this.predictionGrid)
    console.log("TU PREDYKCJA????", this.twoHoursPrediction)
    console.log("te caqi", this.caqiMarkers)
  }

  private runMap(): void {
    this.map = L.map('map', {
      center: [52.2297, 21.0122], //Warsaw
      zoom: 10,
      minZoom: 10,
      maxBounds: [[52,20.3],[52.45,21.6]],
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });
  }

  private addLayer(): void {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
    this.allSourcesLayer.addTo(this.map);
  }

  private runInterpolation(x:number, y:number, minLat:number, minLon:number, step:number): void {

    for (let i = 0; i < y; i++) {   //LONGITUDE
      for (let j = 0; j < x; j++) {  //LATITUDE
        const lat = minLat + (i + 0.5) * step;
        const lon = minLon + (j + 0.5) * step;

        const pm10: number = inversedWeightedInterpolation(this.caqiMarkers, lat, lon, "pm10")
        const pm25:  number = inversedWeightedInterpolation(this.caqiMarkers, lat, lon, "pm25")
        const no2: number  = inversedWeightedInterpolation(this.caqiMarkers, lat, lon, "no2")
        const o3:  number = inversedWeightedInterpolation(this.caqiMarkers, lat, lon, "o3")
        const potentialCAQI: number[] = []


        const vPM10 = calculateCAQI(pm10, PM10Breakpoints);
        if (vPM10 != null) potentialCAQI.push(vPM10);


        // if (pm25 != null) {
          const vPM25 = calculateCAQI(pm25, PM25Breakpoints);
          if (vPM25 != null) potentialCAQI.push(vPM25);
        // }

        // if (no2 != null) {
          const vNO2 = calculateCAQI(no2, NO2Breakpoints);
          if (vNO2 != null) potentialCAQI.push(vNO2);
        // }

        // if (o3 != null) {
          const vO3 = calculateCAQI(o3, O3Breakpoints);
          if (vO3 != null) potentialCAQI.push(vO3);
        // }
        const caqi: number = Math.max(...potentialCAQI)
        // if (i == y/2 + 2 && j == Math.round(x/2 + 2)) { //centrum góra
        //   console.log("centrum góra", i, j)
        //   this.predictionGrids.no2[i][j] = 200
        //   this.predictionGrids.pm10[i][j] = 200
        //   this.predictionGrids.o3[i][j] = 200
        //   this.predictionGrids.pm25[i][j] = 200
        // } else if (i == (y/2) && j == Math.round(x/2) + 23) {  //wschód
        //   console.log("wschód", i, j)
        //   this.predictionGrids.no2[i][j] = 200
        //   this.predictionGrids.pm10[i][j] = 200
        //   this.predictionGrids.o3[i][j] = 200
        //   this.predictionGrids.pm25[i][j] = 200
        // } else if (i == (y/2 + 13) && j == Math.round(x/2) - 20) { //odludzie
        //   console.log("odludzie", i, j)
        //   this.predictionGrids.no2[i][j] = 200
        //   this.predictionGrids.pm10[i][j] = 200
        //   this.predictionGrids.o3[i][j] = 200
        //   this.predictionGrids.pm25[i][j] = 200
        // } else if (i == (y/2 - 2) && j == Math.round(x/2) + 5) { //dół centrum
        //   console.log("centrum dół", i, j)
        //   this.predictionGrids.no2[i][j] = 200
        //   this.predictionGrids.pm10[i][j] = 200
        //   this.predictionGrids.o3[i][j] = 200
        //   this.predictionGrids.pm25[i][j] = 200
        // } else if (i == (y/2 - 10) && j == Math.round(x/2) + 6) { //południe
        //   console.log("południe", i,j)
        //   this.predictionGrids.no2[i][j] = 200
        //   this.predictionGrids.pm10[i][j] = 200
        //   this.predictionGrids.o3[i][j] = 200
        //   this.predictionGrids.pm25[i][j] = 200
        // }

        // else {
          this.predictionGrids.no2[i][j] = no2
          this.predictionGrids.pm10[i][j] = pm10
          this.predictionGrids.o3[i][j] = o3
          this.predictionGrids.pm25[i][j] = pm25
        // }
        // if (typeof pm25 == 'number' ) {

        // }

        this.grid.push({lat, lon, caqi: Math.round(caqi * 10) / 10})
      }
    }
  }

  private runPrediction(x:number, y:number, minLat:number, maxLat:number, minLon:number, step:number): void {
    const latAngle = (minLat + maxLat) * 0.5 * Math.PI / 180

    const hy = 1110;
    const hx = hy * Math.cos(latAngle)
    const kappa = 0.1
    const u = this.windVector?.u ?? 0
    const v = this.windVector?.v ?? 0
    // const dt = 0.5 * h / maxWind;  //bo dt nie może być większy niż czas przeskoku 1 kratki wiatru

    const dtAdvX =  u !== 0 ? hx / Math.abs(u) : Infinity;
    const dtAdvY = v !== 0 ? hy / Math.abs(v) : Infinity;
    const dtAdvection = 0.5 * Math.min(dtAdvX, dtAdvY)

    const dtDiffusion = 0.25 * (hx*hx * hy*hy) / (kappa * (hx*hx + hy*hy))

    const dt = Math.min(dtAdvection, dtDiffusion)

    const steps120 = Math.round((2 * 3600) / dt);

    const results = {
      pm10: runAdvectionDiffusion(this.predictionGrids.pm10, steps120, u, v, dt, hx, hy, kappa),
      pm25: runAdvectionDiffusion(this.predictionGrids.pm25, steps120, u, v, dt, hx, hy, kappa),
      no2: runAdvectionDiffusion(this.predictionGrids.no2,  steps120, u, v, dt, hx, hy, kappa),
      o3: runAdvectionDiffusion(this.predictionGrids.o3,   steps120, u, v, dt, hx, hy, kappa),
    };

    for (let i = 0; i < y; i++) {
      for (let j = 0; j < x; j++) {
        const caqi30 = calculateCAQIFromCell({
          pm10: results.pm10.t30[i][j],
          pm25: results.pm25.t30[i][j],
          no2: results.no2.t30[i][j],
          o3: results.o3.t30[i][j],
        });
        const caqi60 = calculateCAQIFromCell({
          pm10: results.pm10.t60[i][j],
          pm25: results.pm25.t60[i][j],
          no2: results.no2.t60[i][j],
          o3: results.o3.t60[i][j],
        });
        const caqi120 = calculateCAQIFromCell({
          pm10: results.pm10.t120[i][j],
          pm25: results.pm25.t120[i][j],
          no2: results.no2.t120[i][j],
          o3: results.o3.t120[i][j],
        });

        this.halfHourPrediction.push({
          lat: minLat + i * step,
          lon: minLon + j * step,
          caqi: caqi30
        })

        this.oneHourPrediction.push({
          lat: minLat + i * step,
          lon: minLon + j * step,
          caqi: caqi60
        })

        this.twoHoursPrediction.push({
          lat: minLat + i * step,
          lon: minLon + j * step,
          caqi: caqi120
        })
      }
    }
    // CZĘŚĆ DO WALIDACJI
    //aktualne
    // console.log("aktualny PUNKT [17][91]:", {
    //   pm10: Math.round(this.predictionGrids.pm10[17][91]),
    //   pm25: Math.round(this.predictionGrids.pm25[17][91]),
    //   no2:  Math.round(this.predictionGrids.no2[17][91]),
    //   o3:   Math.round(this.predictionGrids.o3[17][91]),
    // });
    // console.log("aktualny PUNKT [27][108]:", {
    //   pm10: Math.round(this.predictionGrids.pm10[27][108]),
    //   pm25: Math.round(this.predictionGrids.pm25[27][108]),
    //   no2:  Math.round(this.predictionGrids.no2[27][108]),
    //   o3:   Math.round(this.predictionGrids.o3[27][108]),
    // });
    // console.log("aktualny PUNKT [25][90]:", {
    //   pm10: Math.round(this.predictionGrids.pm10[25][90]),
    //   pm25: Math.round(this.predictionGrids.pm25[25][90]),
    //   no2:  Math.round(this.predictionGrids.no2[25][90]),
    //   o3:   Math.round(this.predictionGrids.o3[25][90]),
    // });
    // console.log("aktualny PUNKT [40][65]:", {
    //   pm10: Math.round(this.predictionGrids.pm10[27][108]),
    //   pm25: Math.round(this.predictionGrids.pm25[27][108]),
    //   no2:  Math.round(this.predictionGrids.no2[27][108]),
    //   o3:   Math.round(this.predictionGrids.o3[27][108]),
    // });
    // console.log("aktualny PUNKT [29][87]:", {
    //   pm10: Math.round(this.predictionGrids.pm10[29][87]),
    //   pm25: Math.round(this.predictionGrids.pm25[29][87]),
    //   no2:  Math.round(this.predictionGrids.no2[29][87]),
    //   o3:   Math.round(this.predictionGrids.o3[29][87]),
    // });
    // //30minut
    // console.log("predykcja30 PUNKT [17][91]:", {
    //   pm10: Math.round(results.pm10.t30[17][91]),
    //   pm25: Math.round(results.pm25.t30[17][91]),
    //   no2:  Math.round(results.no2.t30[17][91]),
    //   o3:   Math.round(results.o3.t30[17][91]),
    // });
    // console.log("predykcja30 [27][108]:", {
    //   pm10: Math.round(results.pm10.t30[27][108]),
    //   pm25: Math.round(results.pm25.t30[27][108]),
    //   no2:  Math.round(results.no2.t30[27][108]),
    //   o3:   Math.round(results.o3.t30[27][108]),
    // });
    // console.log("predykcja30 [25][90]:", {
    //   pm10: Math.round(results.pm10.t30[25][90]),
    //   pm25: Math.round(results.pm25.t30[25][90]),
    //   no2:  Math.round(results.no2.t30[25][90]),
    //   o3:   Math.round(results.o3.t30[25][90]),
    // });
    // console.log("predykcja30 [40][65]:", {
    //   pm10: Math.round(results.pm10.t30[40][65]),
    //   pm25: Math.round(results.pm25.t30[40][65]),
    //   no2:  Math.round(results.no2.t30[40][65]),
    //   o3:   Math.round(results.o3.t30[40][65]),
    // });
    // console.log("predykcja30 [29][87]:", {
    //   pm10: Math.round(results.pm10.t30[29][87]),
    //   pm25: Math.round(results.pm25.t30[29][87]),
    //   no2:  Math.round(results.no2.t30[29][87]),
    //   o3:   Math.round(results.o3.t30[29][87]),
    // });
    // //60minut
    // console.log("predykcja1h [17][91]:", {
    //   pm10: Math.round(results.pm10.t60[17][91]),
    //   pm25: Math.round(results.pm25.t60[17][91]),
    //   no2:  Math.round(results.no2.t60[17][91]),
    //   o3:   Math.round(results.o3.t60[17][91]),
    // });
    // console.log("predykcja1h [27][108]:", {
    //   pm10: Math.round(results.pm10.t60[27][108]),
    //   pm25: Math.round(results.pm25.t60[27][108]),
    //   no2:  Math.round(results.no2.t60[27][108]),
    //   o3:   Math.round(results.o3.t60[27][108]),
    // });
    // console.log("predykcja1h [25][90]:", {
    //   pm10: Math.round(results.pm10.t60[25][90]),
    //   pm25: Math.round(results.pm25.t60[25][90]),
    //   no2:  Math.round(results.no2.t60[25][90]),
    //   o3:   Math.round(results.o3.t60[25][90]),
    // });
    // console.log("predykcja1h [40][65]:", {
    //   pm10: Math.round(results.pm10.t60[40][65]),
    //   pm25: Math.round(results.pm25.t60[40][65]),
    //   no2:  Math.round(results.no2.t60[40][65]),
    //   o3:   Math.round(results.o3.t60[40][65]),
    // });
    // console.log("predykcja1h [29][87]:", {
    //   pm10: Math.round(results.pm10.t60[29][87]),
    //   pm25: Math.round(results.pm25.t60[29][87]),
    //   no2:  Math.round(results.no2.t60[29][87]),
    //   o3:   Math.round(results.o3.t60[29][87]),
    // });
    // //120minut
    // console.log("predykcja2h [17][91]:", {
    //   pm10: Math.round(results.pm10.t120[17][91]),
    //   pm25: Math.round(results.pm25.t120[17][91]),
    //   no2:  Math.round(results.no2.t120[17][91]),
    //   o3:   Math.round(results.o3.t120[17][91]),
    // });
    // console.log("predykcja2h [27][108]:", {
    //   pm10: Math.round(results.pm10.t120[27][108]),
    //   pm25: Math.round(results.pm25.t120[27][108]),
    //   no2:  Math.round(results.no2.t120[27][108]),
    //   o3:   Math.round(results.o3.t120[27][108]),
    // });
    // console.log("predykcja2h [25][90]:", {
    //   pm10: Math.round(results.pm10.t120[25][90]),
    //   pm25: Math.round(results.pm25.t120[25][90]),
    //   no2:  Math.round(results.no2.t120[25][90]),
    //   o3:   Math.round(results.o3.t120[25][90]),
    // });
    // console.log("predykcja2h [40][65]:", {
    //   pm10: Math.round(results.pm10.t120[40][65]),
    //   pm25: Math.round(results.pm25.t120[40][65]),
    //   no2:  Math.round(results.no2.t120[40][65]),
    //   o3:   Math.round(results.o3.t120[40][65]),
    // });
    // console.log("predykcja2h [29][87]:", {
    //   pm10: Math.round(results.pm10.t120[29][87]),
    //   pm25: Math.round(results.pm25.t120[29][87]),
    //   no2:  Math.round(results.no2.t120[29][87]),
    //   o3:   Math.round(results.o3.t120[29][87]),
    // });
  }
  toggleView(): void {
    if (this.viewMode === 'sources') {
      this.map.removeLayer(this.allSourcesLayer);
      this.drawCaqiMarkers();
      this.map.addLayer(this.caqiLayer);
      this.viewMode = 'caqi';

    } else {
      this.map.removeLayer(this.caqiLayer);
      this.drawMarkers()
      this.map.addLayer(this.allSourcesLayer);
      this.viewMode = 'sources'
    }
  }

  toggleSource(source: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;       //zamiast klasycznego getdocumentbyid, to angular
    this.chosenSources[source] = isChecked;                                      //zmienia na true lub false zależnie czy 'odhaczony'
    if (this.viewMode == 'sources') {
      this.drawMarkers();
    }
    else if (this.viewMode == 'caqi') {
      this.drawCaqiMarkers()
    }
  }

  interpolationView (): void {
    if (this.interpolationViewMode === 'off') {
      this.interpolationViewMode = 'on';
      this.drawInterpolation()
      this.map.addLayer(this.interpolationLayer);
    } else {
      this.interpolationViewMode = 'off';
      this.map.removeLayer(this.interpolationLayer);
    }
  }

  predictionView (h: 0.5 | 1 | 2): void {
    if (h == this.predictionViewStatus) {
      this.map.removeLayer(this.predictionLayer);
      this.predictionViewStatus = null;
    }
    else {
      this.map.removeLayer(this.predictionLayer);
      this.predictionViewStatus = h
      this.drawPrediction(h)
      this.map.addLayer(this.predictionLayer);
    }
  }

  private async getWind() {
    try {
      const response = await fetch("http://localhost:3000/api/wind");
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json()

      this.windData = {
        direction: data.direction,
        speed: data.speed,
      }
      console.log("WIATR:", this.windData);

    } catch (error) {
      console.error("getOpenAQ error:", error);
    }
  }

  private async getOpenAQ() {
    try {
      const response = await fetch("http://localhost:3000/api/openaq");
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);
      console.log("API data:", this.allData);

    } catch (error) {
      console.error("getOpenAQ error:", error);
    }
  }

  private async getGIOS() {
    try {
      const response = await fetch("http://localhost:3000/api/gios");
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);
      console.log("API data:", this.allData);
    } catch (error) {
      console.error("getGIOS error:", error);
    }
  }

  private async getAirly() {
    try {
      const response = await fetch("http://localhost:3000/api/airly");
      const data = await response.json()
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error) {
      console.error("getAirly error:", error);
    }
  }

  private async getWarsawIoT() {
    try {
      const response = await fetch("http://localhost:3000/api/warsawIoT");

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json()
      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error) {
      console.error("getWarsawIoT error:", error);
    }
  }

  private async getAQICN() {
    try {
      const response = await fetch("http://localhost:3000/api/aqicn");

      if (!response.ok) {
        throw new Error("AQICN error");
      }

      const data = await response.json();
      console.log("Aqicn", data)
      this.allData.push(...data);

    } catch (error) {
      console.error("getAQICN error:", error);
    }
  }

  private getCAQI({ pm10, pm25, no2, o3 }: {
    pm10: number | null;
    pm25: number | null;
    no2: number | null;
    o3: number | null;
  }) {

    let values: number[] = []
    if (pm25 != null) {
      const v = calculateCAQI(pm25, PM25Breakpoints);
      if ( v !== null) {
        values.push(v)
      }
    }
    if (pm10 != null) {
      const v = calculateCAQI(pm10, PM10Breakpoints);
      if ( v !== null) {
        values.push(v)
      }
    }

    if (no2 != null) {
       const v = calculateCAQI(no2, NO2Breakpoints);
       if ( v !== null) {
        values.push(v)
       }
    }

    if (o3 != null) {
       const v = calculateCAQI(o3, O3Breakpoints);
       if ( v !== null) {
        values.push(v)
       }
    }

    if (!values.length) return null;

    return Math.round(Math.max(...values));
  }

  private addMarkers(): void {

    const grouped: { [key: string]: any[] } = {};

    for (const loc of this.allData) {

      const key = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(loc);
    }

    for (const key in grouped) {
      const locations = grouped[key];
      const [lat, lon] = key.split(',').map(Number);
      const sources = locations.map(l => l.source);
      const pollutants : {pm10: number | null, pm25: number | null, no2: number | null, o3: number | null} = {
        pm10: null,
        pm25: null,
        no2: null,
        o3: null
      };
      const pm10Candidates: { value: number; source: string }[] = [];
      const pm25Candidates: { value: number; source: string }[] = [];
      const no2Candidates: { value: number; source: string }[] = [];
      const o3Candidates: { value: number; source: string }[] = [];

        for (const loc of locations) {
          if (loc.measurements ) {
            if (Array.isArray(loc.measurements)) {
              for (const p of loc.measurements) {
                if (!this.checkTime(p.time)) {continue}

                if (p.name.toUpperCase() === 'PM10') {
                  if (p.value !== null) {
                    pm10Candidates.push({
                      value: p.value,
                      source: loc.source
                    })
                  }

                }
                if (p.name.toUpperCase() === 'PM25' || p.name.toUpperCase() === 'PM2.5') {
                  if (p.value !== null) {
                    pm25Candidates.push({
                      value: p.value,
                      source: loc.source
                    })
                  }
                }
                if (p.name.toUpperCase() === 'NO2') {
                  if (p.value !== null) {
                    no2Candidates.push({
                      value: p.value,
                      source: loc.source
                    })
                  }
                }
                if (p.name.toUpperCase() === 'O3') {
                  if (p.value !== null) {
                    o3Candidates.push({
                      value: p.value,
                      source: loc.source
                    })
                  }
                }
              }
            }
          }

          if (pm10Candidates.length > 0) {
            pollutants.pm10 = Math.max(...pm10Candidates.map(v => (v.value)))
          }

          if (no2Candidates.length > 0) {
            pollutants.no2 = Math.max(...no2Candidates.map(v => (v.value)))
          }

          if (o3Candidates.length > 0) {
            pollutants.o3 = Math.max(...o3Candidates.map(v => (v.value)))
          }

          if (pm25Candidates.length > 0) {
            pollutants.pm25 = Math.max(...pm25Candidates.map(v => (v.value)))
          }

          const checkAqicn = this.checkTime(loc.time?.stime)
          if (loc.source === 'aqicn' && checkAqicn && loc.measurements) {
            const values = loc.measurements

            if (pollutants.pm10 == null || pollutants.pm10 < values.pm10) {
              pollutants.pm10 = values.pm10 ?? pollutants.pm10;
            }

            if (pollutants.pm25 == null ||  pollutants.pm25 < values.pm25) {
              pollutants.pm25 = values.pm25 ?? pollutants.pm25;
            }

            if (pollutants.no2 == null || pollutants.no2 < values.no2) {
              pollutants.no2 = values.no2 ?? pollutants.no2;
            }

            if (pollutants.o3 == null || pollutants.o3 < values.o3) {
              pollutants.o3 = values.o3 ?? pollutants.o3;
            }
          }
        }

      if (pollutants.pm25 !== null || pollutants.pm10 !== null || pollutants.no2 !== null || pollutants.o3 !== null ) {
        const caqi = this.getCAQI(pollutants);
          this.caqiMarkers.push({
            lat,
            lon,
            caqi,
            sources,
            pollutants
          });
      }

      const airlyConditions = ['airly', 'airly (saved)']
      const hasAirly = airlyConditions.some(word => sources.includes(word));
      const hasGios = sources.includes('gios');
      const hasOpenAQ = sources.includes('openaq');
      const hasIoT = sources.includes('warsawIoT');
      const hasAQICN = sources.includes('aqicn');

      let icon: L.DivIcon;

      if (hasGios && hasAirly && hasOpenAQ && hasIoT && hasAQICN) {
        icon = this.createUltimateIcon();
      } else if (hasAQICN && hasIoT && hasGios && hasOpenAQ) {
        icon = this.createMixedIconOfFour('#eebb33','#12ff77', '#ee22ee', '#114499')
      } else if (hasAirly && hasGios && hasOpenAQ) {
        icon = this.createMixedIconOfThree('#12ff77', '#ff1133', '#114499');
      } else if (hasGios && hasOpenAQ && hasIoT) {
        icon = this.createMixedIconOfThree('#12ff77', '#eebb33', '#114499')
      } else if (hasGios && hasOpenAQ && hasAQICN) {
        icon = this.createMixedIconOfThree('#12ff77', '#eebb33', '#ee22ee')
      } else if (hasAirly && hasGios) {
        icon = this.createMixedIcon('#ee0022', '#00c853');
      } else if (hasAirly && hasOpenAQ) {
        icon = this.createMixedIcon('#2196f3', '#ee0022');
      } else if (hasGios && hasOpenAQ) {
        icon = this.createMixedIcon('#00c853', '#2196f3');
      } else if (hasOpenAQ && hasAQICN) {
        icon = this.createMixedIcon('#2196f3', '#ee22ee');
      } else if (hasGios && hasAQICN) {
        icon = this.createMixedIcon('#00c853', '#ee22ee');
      } else if (hasAirly) {
        icon = this.createAirlyIcon();
      } else if (hasGios) {
        icon = this.createGiosIcon();
      } else if (hasIoT) {
        icon = this.createWarsawIoTIcon();
      } else if (hasAQICN) {
        icon = this.createAqicnIcon();
      }
      else {
        icon = this.createopenAQIcon(true);
      }

      const marker = L.marker([lat, lon], {icon})
        .bindPopup(this.buildPopupContent(locations));

      this.allMarkers.push({
        marker,
        sources
      });
      marker.addTo(this.allSourcesLayer)
      // for (const s of sources) {
      //   const layer = this.sourceLayers[s];
      //   if (layer) marker.addTo(layer);
      // }
    }
  }
  private drawMarkers(): void {
    this.allSourcesLayer.clearLayers();
    for (const m of this.allMarkers) {
      const isActive = m.sources.some(source => this.chosenSources[source])
      if (isActive) {
        m.marker.addTo(this.allSourcesLayer)
      }
    }
  }
  private drawCaqiMarkers(): void {
    this.caqiLayer.clearLayers();

    for (const m of this.caqiMarkers) {
      if (m.caqi == null) continue;

      const isActive = m.sources.some(source => this.chosenSources[source])
      if (!isActive) {continue}

      const icon = this.createCaqiIcon(m.caqi);

      L.marker([m.lat, m.lon], { icon })
        .bindPopup(`
          <b>CAQI:</b> ${m.caqi}<br>
          PM10: ${m.pollutants.pm10 !== null ? m.pollutants.pm10 : '-'}<br>
          PM2.5: ${m.pollutants.pm25 !== null ? m.pollutants.pm25 : '-'}<br>
          NO2: ${m.pollutants.no2 !== null ? m.pollutants.no2 : '-'}<br>
          O3: ${m.pollutants.o3 !== null ? m.pollutants.o3 : '-'}
        `)
        .addTo(this.caqiLayer);
    }
  }

  private drawInterpolation() {
    this.interpolationLayer.clearLayers();
    const step = 0.01
    for (const i of this.grid) {
      const color = this.paintCaqi(i.caqi)
      if (color != null) {
        const cornerOne = L.latLng(i.lat - step / 2, i.lon - step / 2)
        const cornerTwo = L.latLng(i.lat + step / 2, i.lon + step / 2)
        const bounds= L.latLngBounds(cornerOne, cornerTwo)
        const icon = L.rectangle(bounds,{
          fillColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
          fillOpacity: 0.7,
          stroke: false
        }).addTo(this.interpolationLayer);
        // L.marker([i.lat, i.lon], {icon}).addTo(this.interpolationLayer)
      }
    }
  }

  private drawPrediction(h:number) {
    this.predictionLayer.clearLayers();
    const step = 0.01;
    let period: {lat: number; lon: number; caqi: number }[] = [];

    if (h == 0.5) {
      period = this.halfHourPrediction
    } else if (h == 1) {
      period = this.oneHourPrediction
    } else if (h == 2) {
      period = this.twoHoursPrediction
    }

    for (const i of period) {
      const color = this.paintCaqi(i.caqi)
      if (color != null) {
        const cornerOne = L.latLng(i.lat, i.lon)
        const cornerTwo = L.latLng(i.lat + step, i.lon + step)
        const bounds= L.latLngBounds(cornerOne, cornerTwo)
        const icon = L.rectangle(bounds,{
          fillColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
          fillOpacity: 0.7,
          stroke: false
        }).addTo(this.predictionLayer);
      }
    }
  }

  private createCaqiIcon(caqi: number): L.DivIcon {

    const color = this.paintCaqi(caqi)

    if (!color) {
      return L.divIcon({
      className: 'full-markes',
      html: `
      <div style="
      background-color: #333333);
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid #444444;
      opacity: 0.9;">`
      })
    }

    const borderColor = [Math.max(color[0] - 20, 0), Math.max(color[1] - 20, 0), Math.max(color[2] - 20, 0)];
    return L.divIcon({
      className: 'full-markes',
      html: `
      <div style="
      background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid rgb(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]});
      opacity: 0.9;">`
    })
  }

  private paintCaqi(caqi: number) {
    let hop = 0;
    let intensivity = 0;
    const caqiLevels = [
      { v: 0,   c: [18, 220, 225] },
      { v: 25,  c: [74, 255, 82] },
      { v: 50,  c: [255, 255, 0] },
      { v: 75,  c: [255, 135, 48] },
      { v: 100, c: [255, 49, 100] },
      { v: Infinity,  c: [255, 49, 100] }]

    for (hop; hop < caqiLevels.length; hop++) {
      if (caqi >= caqiLevels[hop].v && caqi < caqiLevels[hop + 1].v) {
        intensivity  = (caqi - caqiLevels[hop].v) / (caqiLevels[hop + 1].v - caqiLevels[hop].v);
        const r = Math.round(caqiLevels[hop].c[0] + (caqiLevels[hop + 1].c[0] - caqiLevels[hop].c[0]) * intensivity);
        const g = Math.round(caqiLevels[hop].c[1] + (caqiLevels[hop + 1].c[1] - caqiLevels[hop].c[1]) * intensivity);
        const b = Math.round(caqiLevels[hop].c[2] + (caqiLevels[hop + 1].c[2] - caqiLevels[hop].c[2]) * intensivity);
        return ([r, g, b])
      }
    }
    return null;
  }

  private createUltimateIcon(): L.DivIcon {
    return L.divIcon({
      className: 'full-markes',
      html:`
      <div style="
      background-color: #76EDC1;
      width: 27px;
      height: 27px;
      border-radius: 50%;
      border: 3px solid #222222;
      opacity: 0.9;">`
    })
  }

  private createAqicnIcon(): L.DivIcon {
    return L.divIcon({
      className: 'aqicn-markes',
      html:`
      <div style="
      background-color: #cc33cc;
      width: 21px;
      height: 21px;
      border-radius: 50%;
      border: 3px solid #ee44ee;
      opacity: 0.8;">`
    })
  }

  private createMixedIcon(color1: string, color2: string): L.DivIcon {
    return L.divIcon({
      className: 'mixed-marker',
      html: `
        <div style="
          background: linear-gradient(135deg, ${color1} 50%, ${color2} 50%);
          width: 21px;
          height: 21px;
          border-radius: 50%;
          border: 3px solid #ddccdd;
          opacity: 0.8;
        "></div>
      `,
    });
  }

  private createMixedIconOfFour(color1: string, color2: string, color3: string, color4: string): L.DivIcon {
    return L.divIcon({
      className: 'mixed-marker',
      html: `
        <div style="
          background: linear-gradient(135deg,
          ${color1} 0%,
          ${color1} 29%,
          ${color2} 29%,
          ${color2} 50%,
          ${color3} 50%,
          ${color3} 71%,
          ${color4} 71%,
          ${color4} 100%);
          width: 25px;
          height: 25px;
          border-radius: 50%;
          border: 3px solid #ddccdd;
          opacity: 0.8;
        "></div>`,
    });
  }
  private createMixedIconOfThree(color1: string, color2: string, color3: string): L.DivIcon {
    return L.divIcon({
      className: 'mixed-marker',
      html: `
        <div style="
          background: linear-gradient(135deg,
          ${color1} 0%,
          ${color1} 33.3%,
          ${color2} 32%,
          ${color2} 68%,
          ${color3} 66.6%,
          ${color3} 100%);
          width: 25px;
          height: 25px;
          border-radius: 50%;
          border: 3px solid #ddccdd;
          opacity: 0.8;
        "></div>`,
    });
  }

  private createWarsawIoTIcon(): L.DivIcon {
    return L.divIcon({
      className: 'warsawIoT-markes',
      html:`
      <div style="
      background-color: #eebb33;
      width: 21px;
      height: 21px;
      border-radius: 50%;
      border: 3px solid #aa8811;
      opacity: 0.8;">`
    })
  }

  private createopenAQIcon(isHigh: boolean): L.DivIcon {
    return L.divIcon({
      className: "AQ-marker",
      html:
        `<div style="
          background-color: #114499;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          border: 3px solid #99aaff;
          opacity: 0.8;
        "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  private createGiosIcon(): L.DivIcon {
    return L.divIcon({
      className: "gios-marker",
      html: `<div style="
        background-color: #00c853;
        width: 21px; height: 21px;
        border-radius: 50%;
        border: 2px solid #aaffaa;
        "></div>`,
    });
  }

  private createAirlyIcon(): L.DivIcon {
    return L.divIcon({
      className: "gios-marker",
      html: `<div style="
        background-color: #ee0022;
        width: 21px;
        height: 21px;
        border-radius: 50%;
        border: 3px solid #ff8888;
        opacity: 0.8;"></div>`,
    });
  }

  private buildPopupContent(locations: any): string {
    const first = locations[0];
    const lat = first.lat.toFixed(3);
    const lon = first.lon.toFixed(3);

    const listItems = locations
      .map((loc:any) => `
        <li>
          <b>Source:</b> ${loc.source}<br>
          ${loc.id ? `<b>ID:</b> ${loc.id}<br>` : ''}
          ${loc.name ? `<b>Name:</b> ${loc.name}<br>` : ''}
        </li>
      `)
      .join('');

    return `
      <div>
        <b>Coordinates:</b> ${lat}, ${lon}<br>
        <ul style="padding-left: 16px; margin: 6px 0;">
          ${listItems}
        </ul>
      </div>
    `;
  }

  private checkTime(time: string) {
    if (!time) return false;
    const ageOfData = Date.now() - new Date(time).getTime();
    return ageOfData < 120 * 60 * 1000;
  }
}




