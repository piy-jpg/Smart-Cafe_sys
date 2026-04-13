const path = require('path');
const fs = require('fs');
const { Menu, Order, OrderItem, User } = require('../models');
const { getAuthActivity, getOwnerControlState, updateOwnerControlState } = require('../utils/ownerControlStore');
const { dialect, sqliteStoragePath } = require('../config/db');

const databasePath = sqliteStoragePath;
const sqlEscape = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
};

exports.downloadDatabaseBackup = async (req, res) => {
  try {
    if (dialect !== 'sqlite') {
      return res.status(400).json({ success: false, message: 'Database file backup is only available for SQLite deployments' });
    }

    if (!fs.existsSync(databasePath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `smart_cafe_backup_${timestamp}.sqlite`;

    res.download(databasePath, fileName, (error) => {
      if (error && !res.headersSent) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to download database backup' });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to prepare database backup' });
  }
};

exports.getDatabaseStatus = async (req, res) => {
  try {
    const exists = dialect === 'sqlite' ? fs.existsSync(databasePath) : true;
    const stats = dialect === 'sqlite' && exists ? fs.statSync(databasePath) : null;

    res.json({
      success: true,
      data: {
        engine: dialect === 'sqlite' ? 'SQLite' : dialect.toUpperCase(),
        file_name: dialect === 'sqlite' ? path.basename(databasePath) : `${dialect}_remote`,
        exists,
        size_bytes: stats?.size || 0,
        updated_at: stats?.mtime || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to read database status' });
  }
};

exports.getOwnerControlCenter = async (_req, res) => {
  try {
    const authActivity = getAuthActivity();
    const controlState = getOwnerControlState();
    const failedAttempts = authActivity.filter((item) => item.outcome === 'failed');
    const recentFailures = failedAttempts.filter((item) => (
      Date.now() - new Date(item.timestamp).getTime() <= 24 * 60 * 60 * 1000
    ));

    const suspiciousActivity = [
      recentFailures.length >= 3 ? {
        level: 'high',
        label: 'Repeated failed logins',
        detail: `${recentFailures.length} failed login attempts recorded in the last 24 hours.`
      } : null,
      authActivity.some((item) => item.role === 'owner' && item.outcome === 'failed') ? {
        level: 'medium',
        label: 'Owner login failures',
        detail: 'At least one failed owner login attempt was detected.'
      } : null
    ].filter(Boolean);

    res.json({
      success: true,
      data: {
        controlState,
        authActivity: authActivity.slice(0, 20),
        suspiciousActivity
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to load owner control center' });
  }
};

exports.updateOwnerControlCenter = async (req, res) => {
  try {
    const updated = updateOwnerControlState(req.body || {});
    if (req.io) req.io.emit('systemControlUpdated');
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update owner control center' });
  }
};

exports.downloadSqlExport = async (req, res) => {
  try {
    const [users, menu, orders, orderItems] = await Promise.all([
      User.findAll({ order: [['id', 'ASC']] }),
      Menu.findAll({ order: [['id', 'ASC']] }),
      Order.findAll({ order: [['id', 'ASC']] }),
      OrderItem.findAll({ order: [['id', 'ASC']] })
    ]);

    const lines = [
      '-- SmartCafe SQL Export',
      '-- Compatible for import workflows in MySQL Workbench / SQL tools',
      `-- Generated at ${new Date().toISOString()}`,
      '',
      'SET FOREIGN_KEY_CHECKS=0;',
      '',
      'CREATE TABLE IF NOT EXISTS users (',
      '  id INT PRIMARY KEY,',
      '  name VARCHAR(100) NOT NULL,',
      '  email VARCHAR(100) NOT NULL,',
      '  password VARCHAR(255) NOT NULL,',
      '  role VARCHAR(50) NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS menu (',
      '  id INT PRIMARY KEY,',
      '  name VARCHAR(100) NOT NULL,',
      '  price DECIMAL(10,2) NOT NULL,',
      '  category VARCHAR(50) NOT NULL,',
      '  stock_quantity INT NOT NULL DEFAULT 0,',
      '  total_received INT NOT NULL DEFAULT 0,',
      '  available TINYINT(1) NOT NULL DEFAULT 1',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS orders (',
      '  id INT PRIMARY KEY,',
      '  table_number INT NOT NULL,',
      '  table_label VARCHAR(50),',
      '  serial_no INT,',
      '  waiter_id INT,',
      '  customer_name VARCHAR(120),',
      '  customer_phone VARCHAR(30),',
      '  payment_method VARCHAR(30),',
      '  payment_received TINYINT(1) NOT NULL DEFAULT 0,',
      '  customer_bill_print_count INT NOT NULL DEFAULT 0,',
      '  kitchen_bill_print_count INT NOT NULL DEFAULT 0,',
      '  last_customer_bill_printed_at DATETIME NULL,',
      '  last_kitchen_bill_printed_at DATETIME NULL,',
      '  add_on_count INT NOT NULL DEFAULT 0,',
      "  status VARCHAR(30) NOT NULL DEFAULT 'pending',",
      '  created_at DATETIME NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS order_items (',
      '  id INT PRIMARY KEY,',
      '  order_id INT NOT NULL,',
      '  menu_id INT NOT NULL,',
      '  add_on_batch INT NOT NULL DEFAULT 0,',
      '  quantity INT NOT NULL DEFAULT 1',
      ');',
      '',
      'DELETE FROM order_items;',
      'DELETE FROM orders;',
      'DELETE FROM menu;',
      'DELETE FROM users;',
      ''
    ];

    users.forEach((user) => {
      lines.push(`INSERT INTO users (id, name, email, password, role) VALUES (${[
        sqlEscape(user.id),
        sqlEscape(user.name),
        sqlEscape(user.email),
        sqlEscape(user.password),
        sqlEscape(user.role)
      ].join(', ')});`);
    });

    menu.forEach((item) => {
      lines.push(`INSERT INTO menu (id, name, price, category, stock_quantity, total_received, available) VALUES (${[
        sqlEscape(item.id),
        sqlEscape(item.name),
        sqlEscape(item.price),
        sqlEscape(item.category),
        sqlEscape(item.stock_quantity),
        sqlEscape(item.total_received),
        sqlEscape(item.available)
      ].join(', ')});`);
    });

    orders.forEach((order) => {
      lines.push(`INSERT INTO orders (id, table_number, table_label, serial_no, waiter_id, customer_name, customer_phone, payment_method, payment_received, customer_bill_print_count, kitchen_bill_print_count, last_customer_bill_printed_at, last_kitchen_bill_printed_at, add_on_count, status, created_at) VALUES (${[
        sqlEscape(order.id),
        sqlEscape(order.table_number),
        sqlEscape(order.table_label),
        sqlEscape(order.serial_no),
        sqlEscape(order.waiter_id),
        sqlEscape(order.customer_name),
        sqlEscape(order.customer_phone),
        sqlEscape(order.payment_method),
        sqlEscape(order.payment_received),
        sqlEscape(order.customer_bill_print_count),
        sqlEscape(order.kitchen_bill_print_count),
        sqlEscape(order.last_customer_bill_printed_at),
        sqlEscape(order.last_kitchen_bill_printed_at),
        sqlEscape(order.add_on_count),
        sqlEscape(order.status),
        sqlEscape(order.created_at)
      ].join(', ')});`);
    });

    orderItems.forEach((item) => {
      lines.push(`INSERT INTO order_items (id, order_id, menu_id, add_on_batch, quantity) VALUES (${[
        sqlEscape(item.id),
        sqlEscape(item.order_id),
        sqlEscape(item.menu_id),
        sqlEscape(item.add_on_batch),
        sqlEscape(item.quantity)
      ].join(', ')});`);
    });

    lines.push('', 'SET FOREIGN_KEY_CHECKS=1;', '');

    const fileName = `smart_cafe_export_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(lines.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to generate SQL export' });
  }
};
