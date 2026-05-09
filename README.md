# AirCompare
Engineering Thesis Project

Web application developed as part of an engineering thesis. Project was built using Angular Framework. It focuses on aggregating and visualising air quality data from multiple external sources

Web application integrates 6 different APIs that share the data about the air quality or wind speed. 
The data is used to visualize air quality in Warsaw. The app shares interactive map that shows the air quality level from over a houndred stations.
Dense network of sensors is used to create an estimation of air quality level in ande around the city using inversed weighted interpolation.
App shares prediction of air quality levels up to two hours calculated using advection-diffusion model.  
Results of interpolation and prediction are rendered as dynamic, semi-transparent layers on top of the interactive map.

Architecture:
-/src/app/map - main frontend 

-Calculations-
-/src/app/interpolation - contains functions calculating interpolation 
-/src/app/prediction - contains functions calculating predictions
-/src/app/aqi - contains functions calculating aqi

-Backend-
-/backend/server.js - REST API for data distribution and real-time updates
-/backend/uploadStaticData.js - optional REST API server, loads data into mySQL database
-/backend/base_aircompare.sql - simple sql script creating MySQL database and tables
