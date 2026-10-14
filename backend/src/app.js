const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const stockRequestRoutes = require("./routes/stockRequestRoutes");
const branchRoutes = require('./routes/branchRoutes');
const menuRoutes = require('./routes/menuRoutes');

const app = express();

app.use(cors());
app.use(express.json());

//UI pages (frontend/) served from the same origin as the API
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
app.get('/', (req, res) => res.redirect('/login.html'));

//API Route
app.use('/api/auth', authRoutes);
app.use("/api/stock-requests", stockRequestRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/menu', menuRoutes);

module.exports = app;