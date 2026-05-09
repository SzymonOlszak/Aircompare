CREATE database air_compare;

CREATE TABLE gios_stations (
	station_id int primary key,
    name varchar(255),
	lat double,
	lon double,
	city varchar(255)
);

CREATE TABLE airly_stations (
	id int primary key,
	name varchar(255),
	lat double,
	lon double,
	city varchar(255),
	street varchar(255),
    origin varchar(255)
);

CREATE TABLE airly_measurements (
	id int auto_increment primary key,
	station_id int not null,
	timestamp datetime not null,
	aqi float,
	params json
);

CREATE TABLE openaq_sensors (
	sensorId int primary key, 
    parameterName varchar(255), 
    unit varchar(255), 
    locationsId bigint,
    name varchar(255),
    lat float,
    lon float
);
