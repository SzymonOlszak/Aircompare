# AirCompare

AirCompare is a web application developed as part of an engineering thesis. The project focuses on aggregating and analyzing air quality data from multiple external sources

Web application integrates 5 different APIs that share the data about the air quality. 
The data is used to visiualize air quality in Warsaw. The app shares interactive map that shows the ari quality level from over a houndred stations.
Dense network of sensors is used to create an interpolation of air quality level and prediction of concentration of pollutants up to 2 hours ahead. To predict the data model of advection and diffusion is used. 
Results of both opparations is presented by an extra layer above the map.

Map:
/src/app/map - main frontend code
/src/app/interpolation - contains functions calculating interpolation and prediction results
