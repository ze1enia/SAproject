const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const stockRequestRoutes = require("./routes/stockRequestRoutes");
const branchRoutes = require('./routes/branchRoutes');
const menuRoutes = require('./routes/menuRoutes');
const productRoutes = require('./routes/productRoutes');
const stockRoutes = require('./routes/stockRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();

app.use(cors());
app.use(express.json());

//UI pages (Interface/) served from the same origin as the API
app.use(express.static(path.join(__dirname, '..', '..', 'Interface')));
app.get('/', (req, res) => res.redirect('/pages/login.html'));

//API Route
app.use('/api/auth', authRoutes);
app.use("/api/stock-requests", stockRequestRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/procurement', deliveryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/staff', staffRoutes);

module.exports = app;