const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
const path = require('path');

// Obsługa plików statycznych i pliku HTML
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Konfiguracja sesji
app.use(session({
    secret: 'token',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000
    }
}));

// Połączenie z bazą danych PostgreSQL
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

// Middleware do sprawdzania sesji
function authenticateSession(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Brak sesji, brak dostępu.' });
    }
    next();
}

// Endpoint do rejestracji
app.post('/api/register', async (req, res) => {
    const { imie, nazwisko, email, haslo, numer_telefonu, ulica, miasto } = req.body;

    try {
        const userCheck = await pool.query('SELECT * FROM uzytkownicy WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Użytkownik z tym adresem email już istnieje' });
        }

        const hashedPassword = await bcrypt.hash(haslo, 10);

        const result = await pool.query(
            `INSERT INTO uzytkownicy (haslo, imie, nazwisko, email, numer_telefonu, ulica, miasto) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [hashedPassword, imie, nazwisko, email, numer_telefonu, ulica, miasto]
        );

        res.status(201).json({ message: 'Użytkownik zarejestrowany', user: result.rows[0] });
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas rejestracji', error: error.message });
    }
});

// Endpoint do logowania
app.post('/api/login', async (req, res) => {
    const { email, haslo } = req.body;

    try {
        const userResult = await pool.query('SELECT * FROM uzytkownicy WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        const user = userResult.rows[0];
        const isPasswordValid = await bcrypt.compare(haslo, user.haslo);

        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Nieprawidłowy email lub hasło' });
        }

        // Zapisz dane użytkownika w sesji
        req.session.user = { id: user.id, email: user.email };
        res.status(200).json({ message: 'Zalogowano pomyślnie' });
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas logowania', error: error.message });
    }
});

// Endpoint do wylogowania
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Błąd podczas wylogowania' });
        }
        res.status(200).json({ message: 'Wylogowano pomyślnie' });
    });
});

// Endpoint do dodawania punktów (z weryfikacją sesji)
app.post('/api/points', authenticateSession, async (req, res) => {
    const { imie, nazwisko, email, opis, latitude, longitude } = req.body;

    try {
        // Zapytanie do dodania punktu
        const insertQuery = 'INSERT INTO niezatwierdzone_szkody (imie, nazwisko, email, opis, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const insertValues = [imie, nazwisko, email, opis, latitude, longitude];
        const insertResult = await pool.query(insertQuery, insertValues);

        const pointId = insertResult.rows[0].id;

        // Zapytanie do sprawdzenia, czy punkt znajduje się w poligonie
        const checkQuery = `
            SELECT 
                CASE 
                    WHEN ST_Within(ST_SetSRID(ST_MakePoint($1, $2), 4326), kopalnia_wszystkie.wkb_geometry) THEN 'TAK' 
                    ELSE 'NIE' 
                END AS teren_kopalni 
            FROM kopalnia_wszystkie
        `;
        const checkValues = [longitude, latitude];
        const checkResult = await pool.query(checkQuery, checkValues);

        // Aktualizacja wartości teren_kopalni
        const updateQuery = 'UPDATE niezatwierdzone_szkody SET teren_kopalni = $1 WHERE id = $2';
        const updateValues = [checkResult.rows[0].teren_kopalni, pointId];
        await pool.query(updateQuery, updateValues);

        res.status(201).json({ id: pointId, teren_kopalni: checkResult.rows[0].teren_kopalni });
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(400).json({ message: 'Błąd podczas zapisu punktu', error: error.message });
    }
});



// Endpoint zabezpieczony sesją
app.get('/api/protected', authenticateSession, (req, res) => {
    res.status(200).json({ message: 'Dostęp do chronionych zasobów', user: req.session.user });
});

// Obsługa błędów i uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});


// Endpoint do pobierania danych zalogowanego użytkownika
app.get('/api/user', authenticateSession, async (req, res) => {
    try {
        const userId = req.session.user.id; // Pobierz ID użytkownika z sesji
        const userResult = await pool.query('SELECT imie, nazwisko, email FROM uzytkownicy WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
        }

        const user = userResult.rows[0];
        res.status(200).json(user); // Zwróć dane użytkownika
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas pobierania danych użytkownika', error: error.message });
    }
});
