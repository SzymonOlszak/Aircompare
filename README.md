# AirCompare
<strong>Engineering Thesis Project</strong>

Web application developed as part of an engineering thesis. Project was built using Angular Framework. It focuses on aggregating and visualizing air quality data from multiple external sources

Web application integrates 6 different APIs that share the data about the air quality or wind speed. <br>
The data is used to visualize air quality in Warsaw. The app shares interactive map that shows the air quality level from over a hundred stations.<br>
Dense network of sensors is used to create an estimation of air quality level in and around the city using Inverse Distance Weighting (IDW).<br>
App shares prediction of air quality levels up to two hours calculated using advection-diffusion model.  <br>
Results of interpolation and prediction are rendered as dynamic, semi-transparent layers on top of the interactive map.<br>

Architecture:<br>
`/src/app/map` - main frontend 

-Calculations-<br>
`/src/app/interpolation` - contains functions calculating interpolation <br>
`/src/app/prediction` - contains functions calculating predictions<br>
`/src/app/aqi` - contains functions calculating AQI - air quality index<br>

-Backend-<br>
`/backend/server.js` - Core Node.js server handling REST API requests and real-time data distribution<br>
`/backend/uploadStaticData.js` - Node.js script for migrating static data into the MySQL database<br>
`/backend/base_aircompare.sql` - simple sql script creating MySQL database and tables<br>

Tech Stack:
Frontend: Angular, Typescript, Leaflet map library<br>
Backend: Node.js (Express), MySQL<br>
Mathematical models: Inverse Distance Weighting, Advection-Diffusion
  
