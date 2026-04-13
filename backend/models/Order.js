const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  table_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  table_label: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  serial_no: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  restaurant_code: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  session_id: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  order_source: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'staff'
  },
  waiter_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  customer_phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  special_instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  handover_target: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_received: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  payment_recorded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  table_cleared: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  refund_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  customer_bill_print_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  kitchen_bill_print_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_customer_bill_printed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_kitchen_bill_printed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  add_on_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  edited_after_place: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  last_edited_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  preparing_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ready_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  served_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancellation_reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Order;
