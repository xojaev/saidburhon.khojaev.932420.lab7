const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;


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


app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});