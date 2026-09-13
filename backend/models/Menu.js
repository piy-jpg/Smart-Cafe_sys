const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Menu = sequelize.define('Menu', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  item_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Veg'
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  total_received: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'menu',
  timestamps: false
});

module.exports = Menu;
