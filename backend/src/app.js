const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const stockRequestRoutes = require("./routes/stockRequestRoutes");

const app = express();

app.use(cors());
app.use(express.json());

//Interface (login / welcome pages) served from the same origin as the API
app.use(express.static(path.join(__dirname, 'Interface')));
app.get('/', (req, res) => res.redirect('/login.html'));

//API Route
app.use('/api/auth', authRoutes);
app.use("/api/stock-requests", stockRequestRoutes);

module.exports = app;