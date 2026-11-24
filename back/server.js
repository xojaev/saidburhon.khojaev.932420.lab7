const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose(); // 1. Подключаем SQLite

const app = express();
const PORT = 3000;

// Включаем парсинг JSON (нужно для POST-запросов в 7-й лабе)
app.use(express.json());

// ==========================================
// СТАТИКА ИЗ 6 ЛАБЫ (ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ)
// ==========================================
app.use(express.static(path.join(__dirname, '../src')));
app.use('/img', express.static(path.join(__dirname, '../img')));
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src', 'lab2.html'));
});

app.get('/about', (req, res) => {
    res.send('<h1>О себе</h1><p>Привет! Я техногик и обзорщик гаджетов. Это страница /about.</p><a href="/">На главную</a>');
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер работает' });
});

const currencyData = {
    USD: [90, 91, 92, 93, 94, 95, 96],
    EUR: [98, 99, 100, 101, 102, 101, 100],
    CNY: [12, 12.5, 13, 13.2, 13.5, 13.8, 14]
};

app.get('/api/rates/:currency', (req, res) => {
    const currency = req.params.currency.toUpperCase();
    
    if (currencyData[currency]) {
        const rates = currencyData[currency];
        const avg = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        
        res.json({
            currency: currency,
            rates: rates,
            avg: Number(avg.toFixed(2))
        });
    } else {
        res.status(404).json({ error: 'Валюта не поддерживается' });
    }
});

// ==========================================
// БАЗА ДАННЫХ И БИЛЕТЫ (НОВОЕ ДЛЯ 7 ЛАБЫ)
// ==========================================

// 2. Создаем файл базы данных
const db = new sqlite3.Database('./tickets.db', (err) => {
    if (err) console.error("Ошибка подключения к БД:", err.message);
    else console.log("Подключено к базе данных SQLite.");
});

// 3. Создаем таблицу билетов
db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        remaining INTEGER NOT NULL
    )
`, (err) => {
    if (err) console.error(err.message);
    
    // Добавляем тестовые данные, если таблица пустая
    db.get("SELECT COUNT(*) as count FROM tickets", (err, row) => {
        if (row.count === 0) {
            const insert = `INSERT INTO tickets (event_id, type, price, remaining) VALUES (?, ?, ?, ?)`;
            db.run(insert, [7, 'general', 1500, 50]);
            db.run(insert, [7, 'vip', 5000, 10]);
            db.run(insert, [8, 'general', 2000, 100]);
            console.log("Тестовые билеты добавлены в БД.");
        }
    });
});

// 4. GET: Получить билеты (с фильтрацией ?event_id=)
app.get('/api/tickets', (req, res) => {
    const eventId = req.query.event_id;
    let sql = "SELECT * FROM tickets";
    let params = [];

    if (eventId) {
        sql += " WHERE event_id = ?";
        params.push(eventId);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 5. POST: Создать билет
app.post('/api/tickets', (req, res) => {
    const { event_id, type, price, remaining } = req.body;
    
    if (!event_id || !type || !price || !remaining) {
        return res.status(400).json({ error: "Не все поля заполнены" });
    }

    const sql = `INSERT INTO tickets (event_id, type, price, remaining) VALUES (?, ?, ?, ?)`;
    db.run(sql, [event_id, type, price, remaining], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: "Билет создан" });
    });
});

// 6. PUT: Покупка билета (Транзакция и уменьшение остатка)
app.put('/api/tickets/:id/buy', (req, res) => {
    const ticketId = req.params.id;
    const countToBuy = req.body.count || 1;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        db.get("SELECT remaining FROM tickets WHERE id = ?", [ticketId], (err, row) => {
            if (err || !row) {
                db.run("ROLLBACK");
                return res.status(404).json({ error: "Билет не найден" });
            }

            const newRemaining = row.remaining - countToBuy;

            // Ошибка: остаток уходит в минус
            if (newRemaining < 0) {
                db.run("ROLLBACK"); // Откат транзакции
                return res.status(400).json({ 
                    error: `Недостаточно билетов. В наличии: ${row.remaining}` 
                });
            }

            db.run("UPDATE tickets SET remaining = ? WHERE id = ?", [newRemaining, ticketId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                db.run("COMMIT"); // Фиксируем изменения
                res.json({ message: "Покупка успешна", remaining: newRemaining });
            });
        });
    });
});

// 7. DELETE: Удалить билет
app.delete('/api/tickets/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM tickets WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Билет не найден" });
        res.json({ message: "Билет удален" });
    });
});

// ==========================================
// ЗАПУСК СЕРВЕРА
// ==========================================
app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});