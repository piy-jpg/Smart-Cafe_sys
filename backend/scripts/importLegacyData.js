const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { sequelize, User, Menu, Order, OrderItem } = require('../models');

const projectRoot = path.resolve(__dirname, '..');
const targetDbPath = path.resolve(projectRoot, 'smart_cafe.sqlite');
const dataDir = path.resolve(projectRoot, 'data');

const [, , sourceArg, ...restArgs] = process.argv;
const options = new Set(restArgs);

const normalizeRole = (role) => {
  if (!role) return 'waiter';

  const value = String(role).trim().toLowerCase();
  if (['owner', 'manager', 'chef', 'waiter', 'master_waiter', 'staff'].includes(value)) {
    return value;
  }

  return 'waiter';
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const normalizeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDecimal = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const queryAll = (db, sql) => (
  new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  })
);

const queryOne = (db, sql) => (
  new Promise((resolve, reject) => {
    db.get(sql, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  })
);

const openDatabase = (dbPath) => (
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (error) => {
      if (error) return reject(error);
      resolve(db);
    });
  })
);

const closeDatabase = (db) => (
  new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) return reject(error);
      resolve();
    });
  })
);

const tableExists = async (db, tableName) => {
  const row = await queryOne(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName.replace(/'/g, "''")}'`
  );
  return Boolean(row?.name);
};

const getTableColumns = async (db, tableName) => {
  if (!(await tableExists(db, tableName))) return [];
  const rows = await queryAll(db, `PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
};

const loadTable = async (db, tableName) => {
  if (!(await tableExists(db, tableName))) return [];
  return queryAll(db, `SELECT * FROM ${tableName}`);
};

const backupCurrentFiles = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(projectRoot, 'backups', timestamp);
  ensureDir(backupDir);

  if (fs.existsSync(targetDbPath)) {
    fs.copyFileSync(targetDbPath, path.join(backupDir, 'smart_cafe.sqlite'));
  }

  const authPath = path.join(dataDir, 'auth-activity.json');
  const ownerPath = path.join(dataDir, 'owner-control.json');

  if (fs.existsSync(authPath)) {
    fs.copyFileSync(authPath, path.join(backupDir, 'auth-activity.json'));
  }

  if (fs.existsSync(ownerPath)) {
    fs.copyFileSync(ownerPath, path.join(backupDir, 'owner-control.json'));
  }

  return backupDir;
};

const readJsonFile = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return fallback;
  }
};

const maybeImportSidecarFiles = (sourcePath) => {
  if (!options.has('--import-sidecars')) return [];

  const sourceDir = path.dirname(sourcePath);
  const imported = [];
  const sidecars = [
    ['auth-activity.json', path.join(dataDir, 'auth-activity.json')],
    ['owner-control.json', path.join(dataDir, 'owner-control.json')]
  ];

  ensureDir(dataDir);

  for (const [fileName, destination] of sidecars) {
    const sourceFile = path.join(sourceDir, fileName);
    if (!fs.existsSync(sourceFile)) continue;

    const json = readJsonFile(sourceFile, null);
    if (json === null) continue;

    fs.writeFileSync(destination, JSON.stringify(json, null, 2));
    imported.push(fileName);
  }

  return imported;
};

const main = async () => {
  if (!sourceArg || sourceArg === '--help' || sourceArg === '-h') {
    console.log('Usage: node backend/scripts/importLegacyData.js /absolute/path/to/old.sqlite [--import-sidecars]');
    process.exit(1);
  }

  const sourcePath = path.resolve(process.cwd(), sourceArg);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Legacy database not found: ${sourcePath}`);
    process.exit(1);
  }

  if (sourcePath === targetDbPath) {
    console.error('Source database must be different from the current backend/smart_cafe.sqlite file.');
    process.exit(1);
  }

  const backupDir = backupCurrentFiles();
  console.log(`Backup created at ${backupDir}`);

  const sourceDb = await openDatabase(sourcePath);

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const sourceOrderColumns = await getTableColumns(sourceDb, 'orders');
    const sourceMenuColumns = await getTableColumns(sourceDb, 'menu');
    const sourceOrderItemColumns = await getTableColumns(sourceDb, 'order_items');

    const [sourceUsers, sourceMenu, sourceOrders, sourceOrderItems] = await Promise.all([
      loadTable(sourceDb, 'users'),
      loadTable(sourceDb, 'menu'),
      loadTable(sourceDb, 'orders'),
      loadTable(sourceDb, 'order_items')
    ]);

    const hasPaymentRecordedAt = sourceOrderColumns.includes('payment_recorded_at');
    const hasDiscountAmount = sourceOrderColumns.includes('discount_amount');
    const hasRefundAmount = sourceOrderColumns.includes('refund_amount');
    const hasCustomerBillPrintCount = sourceOrderColumns.includes('customer_bill_print_count');
    const hasKitchenBillPrintCount = sourceOrderColumns.includes('kitchen_bill_print_count');
    const hasLastCustomerBillPrintedAt = sourceOrderColumns.includes('last_customer_bill_printed_at');
    const hasLastKitchenBillPrintedAt = sourceOrderColumns.includes('last_kitchen_bill_printed_at');
    const hasEditedAfterPlace = sourceOrderColumns.includes('edited_after_place');
    const hasLastEditedAt = sourceOrderColumns.includes('last_edited_at');
    const hasPreparingAt = sourceOrderColumns.includes('preparing_at');
    const hasReadyAt = sourceOrderColumns.includes('ready_at');
    const hasServedAt = sourceOrderColumns.includes('served_at');
    const hasCancelledAt = sourceOrderColumns.includes('cancelled_at');
    const hasCancellationReason = sourceOrderColumns.includes('cancellation_reason');
    const hasTableLabel = sourceOrderColumns.includes('table_label');
    const hasSerialNo = sourceOrderColumns.includes('serial_no');
    const hasAddOnCount = sourceOrderColumns.includes('add_on_count');
    const hasCustomerName = sourceOrderColumns.includes('customer_name');
    const hasCustomerPhone = sourceOrderColumns.includes('customer_phone');
    const hasPaymentMethod = sourceOrderColumns.includes('payment_method');
    const hasPaymentReceived = sourceOrderColumns.includes('payment_received');
    const hasStockQuantity = sourceMenuColumns.includes('stock_quantity');
    const hasTotalReceived = sourceMenuColumns.includes('total_received');
    const hasAddOnBatch = sourceOrderItemColumns.includes('add_on_batch');

    const normalizedUsers = sourceUsers.map((user) => ({
      id: normalizeInteger(user.id, undefined),
      name: user.name || `User ${user.id}`,
      email: user.email || `user${user.id}@legacy.local`,
      password: user.password || 'demo',
      role: normalizeRole(user.role)
    }));

    const normalizedMenu = sourceMenu.map((item) => {
      const totalReceived = hasTotalReceived
        ? normalizeInteger(item.total_received, normalizeInteger(item.stock_quantity, 0))
        : normalizeInteger(item.stock_quantity, 0);
      const stockQuantity = hasStockQuantity
        ? normalizeInteger(item.stock_quantity, totalReceived)
        : totalReceived;

      return {
        id: normalizeInteger(item.id, undefined),
        name: item.name || `Menu Item ${item.id}`,
        price: normalizeDecimal(item.price, 0),
        category: item.category || 'Uncategorized',
        stock_quantity: Math.max(stockQuantity, 0),
        total_received: Math.max(totalReceived, Math.max(stockQuantity, 0)),
        available: normalizeBoolean(item.available, Math.max(stockQuantity, 0) > 0)
      };
    });

    const serialSeed = 1000;
    const normalizedOrders = sourceOrders.map((order, index) => {
      const status = ['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(order.status)
        ? order.status
        : 'pending';
      const createdAt = normalizeDate(order.created_at, new Date());
      const paymentReceived = hasPaymentReceived ? normalizeBoolean(order.payment_received, false) : false;

      return {
        id: normalizeInteger(order.id, undefined),
        table_number: normalizeInteger(order.table_number, 0),
        table_label: hasTableLabel
          ? (order.table_label || `Table ${normalizeInteger(order.table_number, 0)}`)
          : `Table ${normalizeInteger(order.table_number, 0)}`,
        serial_no: hasSerialNo ? normalizeInteger(order.serial_no, serialSeed + index) : serialSeed + index,
        waiter_id: order.waiter_id ? normalizeInteger(order.waiter_id, null) : null,
        customer_name: hasCustomerName ? (order.customer_name || null) : null,
        customer_phone: hasCustomerPhone ? (order.customer_phone || null) : null,
        payment_method: hasPaymentMethod ? (order.payment_method || null) : null,
        payment_received: paymentReceived,
        payment_recorded_at: hasPaymentRecordedAt
          ? normalizeDate(order.payment_recorded_at, paymentReceived ? createdAt : null)
          : (paymentReceived ? createdAt : null),
        discount_amount: hasDiscountAmount ? normalizeDecimal(order.discount_amount, 0) : 0,
        refund_amount: hasRefundAmount ? normalizeDecimal(order.refund_amount, 0) : 0,
        customer_bill_print_count: hasCustomerBillPrintCount ? normalizeInteger(order.customer_bill_print_count, 0) : 0,
        kitchen_bill_print_count: hasKitchenBillPrintCount ? normalizeInteger(order.kitchen_bill_print_count, 0) : 0,
        last_customer_bill_printed_at: hasLastCustomerBillPrintedAt ? normalizeDate(order.last_customer_bill_printed_at, null) : null,
        last_kitchen_bill_printed_at: hasLastKitchenBillPrintedAt ? normalizeDate(order.last_kitchen_bill_printed_at, null) : null,
        add_on_count: hasAddOnCount ? normalizeInteger(order.add_on_count, 0) : 0,
        edited_after_place: hasEditedAfterPlace ? normalizeBoolean(order.edited_after_place, false) : false,
        last_edited_at: hasLastEditedAt ? normalizeDate(order.last_edited_at, null) : null,
        preparing_at: hasPreparingAt ? normalizeDate(order.preparing_at, null) : (status !== 'pending' ? createdAt : null),
        ready_at: hasReadyAt ? normalizeDate(order.ready_at, null) : (['ready', 'served'].includes(status) ? createdAt : null),
        served_at: hasServedAt ? normalizeDate(order.served_at, null) : (status === 'served' ? createdAt : null),
        cancelled_at: hasCancelledAt ? normalizeDate(order.cancelled_at, null) : (status === 'cancelled' ? createdAt : null),
        cancellation_reason: hasCancellationReason ? (order.cancellation_reason || null) : null,
        status,
        created_at: createdAt
      };
    });

    const validOrderIds = new Set(normalizedOrders.map((order) => order.id));
    const validMenuIds = new Set(normalizedMenu.map((item) => item.id));

    const normalizedOrderItems = sourceOrderItems
      .map((item) => ({
        id: normalizeInteger(item.id, undefined),
        order_id: normalizeInteger(item.order_id, undefined),
        menu_id: normalizeInteger(item.menu_id, undefined),
        add_on_batch: hasAddOnBatch ? normalizeInteger(item.add_on_batch, 0) : 0,
        quantity: Math.max(normalizeInteger(item.quantity, 1), 1)
      }))
      .filter((item) => validOrderIds.has(item.order_id) && validMenuIds.has(item.menu_id));

    await sequelize.transaction(async (transaction) => {
      await OrderItem.destroy({ where: {}, force: true, transaction });
      await Order.destroy({ where: {}, force: true, transaction });
      await Menu.destroy({ where: {}, force: true, transaction });
      await User.destroy({ where: {}, force: true, transaction });

      if (normalizedUsers.length) {
        await User.bulkCreate(normalizedUsers, { transaction });
      }

      if (normalizedMenu.length) {
        await Menu.bulkCreate(normalizedMenu, { transaction });
      }

      if (normalizedOrders.length) {
        await Order.bulkCreate(normalizedOrders, { transaction });
      }

      if (normalizedOrderItems.length) {
        await OrderItem.bulkCreate(normalizedOrderItems, { transaction });
      }
    });

    const importedSidecars = maybeImportSidecarFiles(sourcePath);
    console.log(`Imported users=${normalizedUsers.length}, menu=${normalizedMenu.length}, orders=${normalizedOrders.length}, order_items=${normalizedOrderItems.length}`);
    if (importedSidecars.length) {
      console.log(`Imported sidecar files: ${importedSidecars.join(', ')}`);
    }
  } finally {
    await closeDatabase(sourceDb);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error('Legacy import failed:', error.message);
  process.exit(1);
});
