const { sequelize } = require('../config/db');
const User = require('./User');
const Menu = require('./Menu');
const Order = require('./Order');
const OrderItem = require('./OrderItem');

// Relationships
Order.belongsTo(User, { foreignKey: 'waiter_id', as: 'waiter' });
User.hasMany(Order, { foreignKey: 'waiter_id' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

OrderItem.belongsTo(Menu, { foreignKey: 'menu_id', as: 'menu_item' });
Menu.hasMany(OrderItem, { foreignKey: 'menu_id' });

module.exports = {
  sequelize,
  User,
  Menu,
  Order,
  OrderItem
};
