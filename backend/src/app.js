const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const stockRequestRoutes = require("./routes/stockRequestRoutes");

const app = express();

app.use(cors());
app.use(express.json());

//API Route
app.use('/api/auth', authRoutes);
app.use("/api/stock-requests", stockRequestRoutes);

module.exports = app;