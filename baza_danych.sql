CREATE TABLE uzytkownicy (
    id SERIAL PRIMARY KEY,
    imie VARCHAR(50) NOT NULL,
    nazwisko VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    ulica VARCHAR(100),
    miasto VARCHAR(50)
);

CREATE TABLE niezatwierdzone_szkody (
    id SERIAL PRIMARY KEY,
    imie VARCHAR(50) NOT NULL,
    nazwisko VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    opis TEXT NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6)
);

SELECT * FROM niezatwierdzone_szkody

