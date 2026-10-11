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
    secret: process.env.SESSION_SECRET,
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
    password: process.env.DB_PASSWORD,
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

// Middleware do sprawdzania ról
function authorizeRole(role) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.rola !== role) {
            return res.status(403).json({ message: 'Brak uprawnień' });
        }
        next();
    };
}

// Endpoint do rejestracji użytkownika
app.post('/api/register', async (req, res) => {
    const { imie, nazwisko, email, haslo, numer_telefonu, ulica, miasto } = req.body;

    try {
        const userCheck = await pool.query('SELECT * FROM uzytkownicy WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Użytkownik z tym adresem email już istnieje' });
        }

        const hashedPassword = await bcrypt.hash(haslo, 10);

        const result = await pool.query(
            `INSERT INTO uzytkownicy (haslo, imie, nazwisko, email, numer_telefonu, ulica, miasto, rola) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'klient') RETURNING *`,
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
        req.session.user = { id: user.id, email: user.email, rola: user.rola };

        // Zwróć rolę użytkownika w odpowiedzi
        res.status(200).json({ message: 'Zalogowano pomyślnie', rola: user.rola });
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
    const { opis, latitude, longitude } = req.body;
    const userId = req.session.user.id; // Zakładamy, że w middleware `authenticateSession` ustawiane jest `req.session.userId`

    try {
        // Zapytanie do dodania punktu
        const insertQuery = `
            INSERT INTO niezatwierdzone_szkody (user_id, opis, latitude, longitude) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id
        `;
        const insertValues = [userId, opis, latitude, longitude];
        const insertResult = await pool.query(insertQuery, insertValues);

        const pointId = insertResult.rows[0].id;

        // Zapytanie do sprawdzenia, czy punkt znajduje się w poligonie
        const checkQuery = `
            SELECT 
                CASE 
                    WHEN EXISTS (
                        SELECT 1
                        FROM kopalnia_wszystkie
                        WHERE ST_Within(ST_SetSRID(ST_MakePoint($1, $2), 4326), kopalnia_wszystkie.wkb_geometry)
                    ) THEN 'TAK'
                    ELSE 'NIE'
                END AS teren_kopalni
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
        const userResult = await pool.query('SELECT imie, nazwisko, email, rola FROM uzytkownicy WHERE id = $1', [userId]);

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

// Endpoint do pobierania  niezatwierdzone szkód dla zalogowanego użytkownika
app.get('/api/szkody', authenticateSession, async (req, res) => {
    try {
        const userId = req.session.user.id; // Pobierz ID użytkownika z sesji

        // Pobierz szkody dla użytkownika
        const query = `
            SELECT opis, czas_utworzenia, longitude, latitude, teren_kopalni 
            FROM niezatwierdzone_szkody 
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json(result.rows); // Zwróć dane szkód
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas pobierania szkód', error: error.message });
    }
});

app.get('/api/zatwierdzone_szkody', authenticateSession, async (req, res) => {
    try {
        const userId = req.session.user.id; // Pobierz ID użytkownika z sesji

        // Pobierz szkody dla użytkownika
        const query = `
            SELECT opis, czas_utworzenia, longitude, latitude, teren_kopalni 
            FROM zatwierdzone_szkody 
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json(result.rows); // Zwróć dane szkód
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas pobierania szkód', error: error.message });
    }
});

app.get('/api/odrzucone_szkody', authenticateSession, async (req, res) => {
    try {
        const userId = req.session.user.id; // Pobierz ID użytkownika z sesji

        // Pobierz szkody dla użytkownika
        const query = `
            SELECT opis, czas_utworzenia, longitude, latitude, teren_kopalni 
            FROM odrzucone_szkody 
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json(result.rows); // Zwróć dane szkód
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas pobierania szkód', error: error.message });
    }
});


app.get('/admin/szkody', authenticateSession, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT ns.id, ns.opis, ns.latitude, ns.longitude, ns.czas_utworzenia, ns.teren_kopalni, u.imie, u.nazwisko, u.email
            FROM niezatwierdzone_szkody ns
            JOIN uzytkownicy u 
            ON ns.user_id = u.id
        `;

        const result = await pool.query(query);
        res.status(200).json(result.rows); // Zwróć wszystkie szkody z danymi użytkowników
    } catch (error) {
        console.error('Szczegóły błędu:', error);
        res.status(500).json({ message: 'Błąd podczas pobierania szkód', error: error.message });
    }
});


// Endpoint do pobierania wszystkich zatwierdzonych szkód dla administratora
app.get('/admin/zatwierdzoneSzkody', authenticateSession, async (req, res) => {
    try {
        const query = `
            SELECT zs.id, zs.opis, zs.latitude, zs.longitude, zs.teren_kopalni, zs.czas_utworzenia, zs.geometry,
                   u.imie, u.nazwisko, u.email
            FROM zatwierdzone_szkody zs
            JOIN uzytkownicy u ON zs.user_id = u.id
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows); // Zwróć dane szkód wraz z informacjami o użytkowniku
    } catch (error) {
        console.error('Błąd podczas pobierania zatwierdzonych szkód:', error);
        res.status(500).json({ message: 'Błąd serwera', error: error.message });
    }
});


// Endpoint do zatwierdzania szkody
app.post('/admin/szkody/:id/zatwierdz', authenticateSession, authorizeRole('admin'), async (req, res) => {
    const szkodaId = req.params.id;

    try {
        // Pobierz szczegóły szkody
        const szkodaResult = await pool.query('SELECT * FROM niezatwierdzone_szkody WHERE id = $1', [szkodaId]);
        const szkoda = szkodaResult.rows[0];

        if (!szkoda) {
            return res.status(404).send('Szkoda nie znaleziona');
        }

        // Zatwierdź szkodę i przenieś ją do tabeli zatwierdzonych
        await pool.query(
            `INSERT INTO zatwierdzone_szkody (opis, latitude, longitude, teren_kopalni, user_id) 
             VALUES ($1, $2, $3, $4, $5)`,
            [szkoda.opis, szkoda.latitude, szkoda.longitude, szkoda.teren_kopalni, szkoda.user_id]
        );        

        // Usuń szkody z tabeli szkód (opcjonalnie)
        await pool.query('DELETE FROM niezatwierdzone_szkody WHERE id = $1', [szkodaId]);

        res.status(200).send('Szkoda zatwierdzona');
    } catch (error) {
        console.error('Błąd podczas zatwierdzania szkody:', error);
        res.status(500).send('Błąd serwera');
    }
});

// Endpoint do odrzucania szkody
app.post('/admin/szkody/:id/odrzuc', async (req, res) => {
    const szkodaId = req.params.id;

    try {
        // Pobierz szczegóły szkody
        const szkodaResult = await pool.query('SELECT * FROM niezatwierdzone_szkody WHERE id = $1', [szkodaId]);
        const szkoda = szkodaResult.rows[0];

        if (!szkoda) {
            return res.status(404).send('Szkoda nie znaleziona');
        }

        // Przenieś szkodę do tabeli odrzuconych
        await pool.query(
            `INSERT INTO odrzucone_szkody (opis, latitude, longitude, teren_kopalni, user_id) 
             VALUES ($1, $2, $3, $4, $5)`,
            [szkoda.opis, szkoda.latitude, szkoda.longitude, szkoda.teren_kopalni, szkoda.user_id]
        );

        // Usuń szkodę z tabeli niezatwierdzonych
        await pool.query('DELETE FROM niezatwierdzone_szkody WHERE id = $1', [szkodaId]);

        res.status(200).send('Szkoda odrzucona');
    } catch (error) {
        console.error('Błąd podczas odrzucania szkody:', error);
        res.status(500).send('Błąd serwera');
    }
});



/*/ pobieranie wstrząsów z bazy
app.get('/api/wstrzasy', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        let query = 'SELECT data, czas, latitude, longitude, energia FROM wykaz_szkod_2004';
        let values = [];

        if (startDate && endDate) {
            query += ' WHERE data BETWEEN $1 AND $2';
            values = [startDate, endDate];
        }

        const results = await pool.query(query, values);
        res.json(results.rows);
    } catch (err) {
        console.error('Błąd zapytania do bazy danych:', err);
        res.status(500).send('Błąd zapytania do bazy danych');
    }
}); */
