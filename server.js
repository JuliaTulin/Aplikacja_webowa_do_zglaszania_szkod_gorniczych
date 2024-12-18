// server.js
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');

const app = express();
const PORT = 4000;

app.use(bodyParser.json());

const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'aplikacja_webowa_mapa',
    password: 'postgres',
    port: 5432,
});

pool.connect((err) => {
    if (err) {
        console.error('Błąd połączenia z bazą danych:', err);
    } else {
        console.log('Połączono z bazą danych PostgreSQL');
    }
});

// Endpoint do dodawania punktów
app.post('/api/points', async (req, res) => {
    const { imie, nazwisko, email, opis, latitude, longitude } = req.body;

    try {
        const query = 'INSERT INTO niezatwierdzone_szkody (imie, nazwisko, email, opis, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
        const values = [imie, nazwisko, email, opis, latitude, longitude];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(400).json({ message: 'Błąd podczas zapisu punktu', error: error.message });
    }
});


// Endpoint do pobierania punktów
app.get('/api/points', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM lokalizacje');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas pobierania punktów', error });
    }
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
