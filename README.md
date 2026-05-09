# AirCompare
<strong>Engineering Thesis Project</strong>

Web application developed as part of an engineering thesis. Project was built using Angular Framework. It focuses on aggregating and visualising air quality data from multiple external sources

Web application integrates 6 different APIs that share the data about the air quality or wind speed. <br>
The data is used to visualize air quality in Warsaw. The app shares interactive map that shows the air quality level from over a houndred stations.<br>
Dense network of sensors is used to create an estimation of air quality level in ande around the city using inversed weighted interpolation.<br>
App shares prediction of air quality levels up to two hours calculated using advection-diffusion model.  <br>
Results of interpolation and prediction are rendered as dynamic, semi-transparent layers on top of the interactive map.<br>

Architecture:<br>
-/src/app/map - main frontend 

-Calculations-<br>
-/src/app/interpolation - contains functions calculating interpolation <br>
-/src/app/prediction - contains functions calculating predictions<br>
-/src/app/aqi - contains functions calculating aqi<br>

-Backend-<br>
-/backend/server.js - REST API for data distribution and real-time updates<br>
-/backend/uploadStaticData.js - optional REST API server, loads data into mySQL database<br>
-/backend/base_aircompare.sql - simple sql script creating MySQL database and tables<br>
