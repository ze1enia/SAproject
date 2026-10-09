const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

//API Route
app.use('/api/auth', authRoutes);

module.exports = app;