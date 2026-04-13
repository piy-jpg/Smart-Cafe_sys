const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.use((req, _res, next) => {
  req.io = app.get('io') || { emit: () => {} };
  next();
});

app.get('/', (_req, res) => {
  res.send('Smart Cafe Backend API is running...');
});

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const menuRoutes = require('./routes/menuRoutes');
const systemRoutes = require('./routes/systemRoutes');
const userRoutes = require('./routes/userRoutes');
const publicRoutes = require('./routes/publicRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/public', publicRoutes);

module.exports = app;
