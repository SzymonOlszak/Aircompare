import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import {CommonModule} from '@angular/common';
import {calculateCAQI, PM25Breakpoints, O3Breakpoints, PM10Breakpoints, NO2Breakpoints} from '../aqi/caqi';
import {inversedWeightedInterpolation} from '../interpolation/interpolation';

const openAQ = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b';
const bbox = "20.85,52.10,21.20,52.35";

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
  private allFreshData: any[] = [];
  private caqiMarkers: {                   //punkty
    lat: number;
    lon: number;
    caqi: number | null;
    sources: string[];
    pollutants: any;
  }[] = [];

  private grid: {                        //interpolacja
    lat: number,
    lon: number,
    caqi: number}[] = []

  private sourceLayer = L.layerGroup();                     //warstwy
  private caqiLayer = L.layerGroup();
  private interpolationLayer = L.layerGroup();
  private giosLayer = L.layerGroup();
  private airlyLayer = L.layerGroup();
  private aqicnLayer = L.layerGroup();
  private warsawIoTLayer = L.layerGroup();
  private openAQLayer = L.layerGroup();

  private sourceLayers: Record<string, L.LayerGroup> = {
    gios: this.giosLayer,
    airly: this.airlyLayer,
    'airly (saved)': this.airlyLayer,
    openaq: this.openAQLayer,
    aqicn: this.aqicnLayer,
    warsawIoT: this.warsawIoTLayer,
  };

  public viewMode: 'sources' | 'caqi' ='sources';
  public interpolationViewMode : 'on' | 'off' = 'off';
  public measurements: any[] = [];
  public stationTitle: string = "";

  async ngOnInit(): Promise <void> {
      this.runMap();
      console.log('MAP BEFORE addLayer', this.map);

      this.addLayer();

      await Promise.all([
        this.getOpenAQ(),
        this.getGIOS(),
        this.getAirly(),
        this.getWarsawIoT(),
        this.getAQICN(),
      ]);

      this.addMarkers()
      const bounds = this.map.getBounds();

      const minLat = bounds.getSouth();
      const maxLat = bounds.getNorth();
      const minLon = bounds.getWest();
      const maxLon = bounds.getEast();
      const step = 0.01
           //INTERPOLACJA
      for (let lat = minLat; lat < maxLat; lat += step) {
        for (let lon = minLon; lon < maxLon; lon += step) {
          const value = inversedWeightedInterpolation(this.caqiMarkers, lat, lon)
          if (value !== null) {
            this.grid.push({lat, lon, caqi: Math.round(value * 10) / 10})
          }
        }
      }
      console.log("TU JEST GRID", this.grid);

      console.log("te caqi", this.caqiMarkers)
      console.log("warstwyyy", this.giosLayer)
  }

  private runMap(): void {
    this.map = L.map('map', {
      center: [52.2297, 21.0122], //Warsaw
      zoom: 10,
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
    this.giosLayer.addTo(this.map);
    this.airlyLayer.addTo(this.map);
    this.openAQLayer.addTo(this.map);
    this.aqicnLayer.addTo(this.map);
    this.warsawIoTLayer.addTo(this.map);

    // this.sourceLayer.addTo(this.map);

    // L.control.layers( {             /////WRÓĆ DO TEGO CZY NA PEWNO TU MA SENS................................
    //   Gios: this.giosLayer,
    //   Airly: this.airlyLayer,
    //   OpenAQ: this.openAQLayer,
    //   AQICN: this.aqicnLayer,
    //   'Warsaw IoT': this.warsawIoTLayer,
    // }).addTo(this.map);
  }

   toggleView(): void {
     if (this.viewMode === 'sources') {
       this.map.removeLayer(this.sourceLayer);
       this.map.addLayer(this.caqiLayer);
       this.drawCaqiMarkers();
       this.viewMode = 'caqi';
     } else {
       this.map.removeLayer(this.caqiLayer);
       this.map.addLayer(this.sourceLayer);
       this.viewMode = 'sources';
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

  private async getOpenAQ() {
    try {
      const response = await fetch("http://localhost:3000/api/openaq");
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);
      console.log("API data:", this.allData);

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
    }
  }

  private async getGIOS() {
    try {
      const response = await fetch("http://localhost:3000/api/gios");
      const data = await response.json()
      console.log("todata", data)
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
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

    } catch (err) {
      console.error(err);
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
      if (!loc.lat || !loc.lon) continue;

      const key = `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`;
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
                  pm10Candidates.push({
                    value: p.value,
                    source: loc.source
                  })
                }
                if (p.name.toUpperCase() === 'PM25') {
                  pm25Candidates.push({
                    value: p.value,
                    source: loc.source
                  })
                }
                if (p.name.toUpperCase() === 'NO2') {
                  no2Candidates.push({
                    value: p.value,
                    source: loc.source
                  })
                }
                if (p.name.toUpperCase() === 'O3') {
                  o3Candidates.push({
                    value: p.value,
                    source: loc.source
                  })
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

          if (loc.source === 'aqicn' && loc.measurements) {
            const values = loc.measurements

            if (pollutants.pm10 == null || pollutants.pm10 < values.pm10) {
              pollutants.pm10 = values.pm10 ?? pollutants.pm10;
            }

            if ((pollutants.pm25 == null && values.pm25 < values.pm10 * 1.5) ||
              (pollutants.pm25 != null && pollutants.pm25 < values.pm25 && values.pm25 < values.pm10 * 1.5)) {
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

      if (pollutants !== null) {
        const caqi = this.getCAQI(pollutants);
        console.log("jakieś CAQI bo czemu nie", caqi)

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
      } else if (hasAirly && hasGios) {
        icon = this.createMixedIcon('#ee0022', '#00c853');
      } else if (hasAirly && hasOpenAQ) {
        icon = this.createMixedIcon('#2196f3', '#ee0022');
      } else if (hasGios && hasOpenAQ) {
        icon = this.createMixedIcon('#00c853', '#2196f3');
      } else if (hasOpenAQ && hasAQICN) {
        icon = this.createMixedIcon('#2196f3', '#ee22ee');
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
        icon = this.createAQIcon(true);
      }

      const marker = L.marker([lat, lon], {icon})
        .on("click", () => this.loadMeasurements(locations[0]))
        .bindPopup(this.buildPopupContent(locations));


      // marker.addTo(this.sourceLayer);

      for (const s of sources) {
        const layer = this.sourceLayers[s];
        console.log("TU ŹRODLO", layer)
        if (layer) marker.addTo(layer);
      }
    }
  }

  private drawCaqiMarkers(): void {
    this.caqiLayer.clearLayers();

    for (const m of this.caqiMarkers) {
      if (m.caqi == null) continue;

      const icon = this.createCaqiIcon(m.caqi);

      L.marker([m.lat, m.lon], { icon })
        .bindPopup(`
          <b>CAQI:</b> ${m.caqi}<br>
          PM10: ${m.pollutants.pm10 ?? '-'}<br>
          PM2.5: ${m.pollutants.pm25 ?? '-'}<br>
          NO2: ${m.pollutants.no2 ?? '-'}<br>
          O3: ${m.pollutants.o3 ?? '-'}
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
        const cornerOne = L.latLng(i.lat, i.lon)
        const cornerTwo = L.latLng(i.lat + step, i.lon + step)
        const bounds= L.latLngBounds(cornerOne, cornerTwo)
        const icon = L.rectangle(bounds,{
          fillColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
          fillOpacity: 0.8,
          stroke: false
        }).addTo(this.interpolationLayer);
        // L.marker([i.lat, i.lon], {icon}).addTo(this.interpolationLayer)
      }
    }

    }


  private createCaqiIcon(caqi: number): L.DivIcon {
    if (caqi < 25) {
      return L.divIcon({
        className: 'full-markes',
        html:`
        <div style="
        background-color: #4DFAC6;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid #42D6AA;
        opacity: 0.9;">`
      })
    } else if (caqi >=25 && caqi <50) {
      return L.divIcon({
        className: 'full-markes',
        html:`
        <div style="
        background-color: #4DDE57;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid #2DBC35;
        opacity: 0.9;">`
      })
    } else if (caqi >=50 && caqi <75) {
      return L.divIcon({
        className: 'full-markes',
        html: `
        <div style="
        background-color: #C8E64E;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid #A8C62E;
        opacity: 0.9;">`
      })
    } else if (caqi >=75 && caqi <100) {
      return L.divIcon({
        className: 'full-markes',
        html: `
        <div style="
        background-color: #E07444;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 3px solid #B05422;
        opacity: 0.9;">`
      })
    }
    else {
      return L.divIcon({
        className: 'full-markes',
        html:`
        <div style="
        background-color: #ff4444;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        border: 3px solid #ee3333;
        opacity: 0.9;">`
      })
    }
  }

  private paintCaqi(caqi: number) {
    let hop = 0;
    let intensivity = 0;
    const caqiLevels = [
      { v: 0,   c: [18, 200, 182] },
      { v: 25,  c: [74, 255, 82] },
      { v: 50,  c: [249, 244, 48] },
      { v: 75,  c: [255, 135, 48] },
      { v: 100, c: [255, 49, 20] }]

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
      iconSize: [16, 16],
      iconAnchor: [8, 8],
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
      // iconSize: [16, 16],
      // iconAnchor: [8, 8],
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
      // iconSize: [16, 16],
      // iconAnchor: [8, 8],
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
  private createAQIcon(isHigh: boolean): L.DivIcon {
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
    // return L.icon({
    //   iconUrl:
    //     'https://leafletjs.com/examples/custom-icons/leaf-red.png',
    //     // : 'https://leafletjs.com/examples/custom-icons/leaf-green.png',
    //   iconSize: [38, 95],
    //   iconAnchor: [22, 94],
    //   shadowUrl: 'https://leafletjs.com/examples/custom-icons/leaf-shadow.png',
    //   shadowSize: [50, 64],
    //   shadowAnchor: [4, 62],
    // });
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
      // iconSize: [14, 14],
      // iconAnchor: [7, 7],
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
    const lat = first.lat.toFixed(5);
    const lon = first.lon.toFixed(5);

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

  async loadMeasurements(point: any) {
    try {
      let url = "";

      if (point.source.includes("openaq")) {
        url = `http://localhost:3000/api/openaq/measurements?id=${point.id}`;
      } // else if (point.source === "aqicn") {
      //   url = `/api/aqicn/measurements?lat=${point.lat}&lon=${point.lon}`;
      // } else if (point.source === "gios") {
      //   url = `/api/gios/measurements?id=${point.id}`;
      // }
      else {
        this.measurements = [];
        this.stationTitle = "No measurements available";
        return;
      }

      const resp = await fetch(url);
      const data = await resp.json();
      this.measurements = data;
      this.stationTitle = point.name || point.source || "Station";

    } catch (err) {
      console.error("Load measurement error:", err);
    }
  }
  private checkTime(time: string) {
    const ageOfData = Date.now() - new Date(time).getTime();
    return ageOfData < 60 * 60 * 1000;
  }
}




