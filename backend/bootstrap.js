const { sequelize, connectDB } = require('./config/db');

let bootstrapPromise = null;

const isDuplicateColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('duplicate column name') || message.includes('duplicate column') || message.includes('already exists');
};

const ensureOrdersSerialIndex = async () => {
  try {
    const indexes = await sequelize.getQueryInterface().showIndex('orders');
    const hasSerialIndex = indexes.some((index) => (
      index.name === 'idx_orders_serial_no'
      || index.fields?.some((field) => field.attribute === 'serial_no')
    ));

    if (!hasSerialIndex) {
      await sequelize.getQueryInterface().addIndex('orders', ['serial_no'], {
        unique: true,
        name: 'idx_orders_serial_no'
      });
    }
  } catch (error) {
    console.error('Error ensuring unique index for orders.serial_no:', error.message);
  }
};

const ensureOrderHistoryColumns = async () => {
  try {
    await sequelize.query('ALTER TABLE menu ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0');
    console.log('Menu table updated with stock_quantity');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring menu.stock_quantity column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE menu ADD COLUMN total_received INTEGER NOT NULL DEFAULT 0');
    console.log('Menu table updated with total_received');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring menu.total_received column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE menu ADD COLUMN image_url TEXT');
    console.log('Menu table updated with image_url');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring menu.image_url column:', error.message);
    }
  }

  try {
    await sequelize.query("ALTER TABLE menu ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'Veg'");
    console.log('Menu table updated with item_type');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring menu.item_type column:', error.message);
    }
  }

  try {
    await sequelize.query(`
      UPDATE menu
      SET stock_quantity = CASE
        WHEN stock_quantity IS NULL THEN 0
        ELSE stock_quantity
      END,
          total_received = CASE
        WHEN total_received IS NULL OR total_received = 0 THEN stock_quantity
        ELSE total_received
      END
    `);
  } catch (error) {
    console.error('Error backfilling menu stock columns:', error.message);
  }

  try {
    await sequelize.query(`
      UPDATE menu
      SET item_type = CASE
        WHEN item_type IS NULL OR TRIM(item_type) = '' THEN 'Veg'
        ELSE item_type
      END
    `);
  } catch (error) {
    console.error('Error backfilling menu item_type column:', error.message);
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN restaurant_code VARCHAR(64)');
    console.log('Orders table updated with restaurant_code');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.restaurant_code column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN session_id VARCHAR(120)');
    console.log('Orders table updated with session_id');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.session_id column:', error.message);
    }
  }

  try {
    await sequelize.query("ALTER TABLE orders ADD COLUMN order_source VARCHAR(30) NOT NULL DEFAULT 'staff'");
    console.log('Orders table updated with order_source');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.order_source column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN add_on_count INTEGER NOT NULL DEFAULT 0');
    console.log('Orders table updated with add_on_count');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.add_on_count column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN serial_no INTEGER');
    console.log('Orders table updated with serial_no');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.serial_no column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN table_label VARCHAR(50)');
    console.log('Orders table updated with table_label');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.table_label column:', error.message);
    }
  }

  await ensureOrdersSerialIndex();

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN customer_name VARCHAR(120)');
    console.log('Orders table updated with customer_name');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.customer_name column:', error.message);
    }
  }

  try {
    await sequelize.query(`
      UPDATE orders
      SET serial_no = 1000 + id - 1
      WHERE serial_no IS NULL
    `);
  } catch (error) {
    console.error('Error backfilling orders.serial_no values:', error.message);
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(30)');
    console.log('Orders table updated with customer_phone');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.customer_phone column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN special_instructions TEXT');
    console.log('Orders table updated with special_instructions');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.special_instructions column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN handover_target VARCHAR(30)');
    console.log('Orders table updated with handover_target');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.handover_target column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30)');
    console.log('Orders table updated with payment_method');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.payment_method column:', error.message);
    }
  }

  try {
    await sequelize.query("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'");
    console.log('Orders table updated with payment_status');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.payment_status column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN payment_received TINYINT(1) NOT NULL DEFAULT 0');
    console.log('Orders table updated with payment_received');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.payment_received column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN payment_recorded_at DATETIME');
    console.log('Orders table updated with payment_recorded_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.payment_recorded_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN table_cleared TINYINT(1) NOT NULL DEFAULT 0');
    console.log('Orders table updated with table_cleared');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.table_cleared column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0');
    console.log('Orders table updated with discount_amount');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.discount_amount column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0');
    console.log('Orders table updated with refund_amount');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.refund_amount column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN customer_bill_print_count INTEGER NOT NULL DEFAULT 0');
    console.log('Orders table updated with customer_bill_print_count');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.customer_bill_print_count column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN kitchen_bill_print_count INTEGER NOT NULL DEFAULT 0');
    console.log('Orders table updated with kitchen_bill_print_count');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.kitchen_bill_print_count column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN last_customer_bill_printed_at DATETIME');
    console.log('Orders table updated with last_customer_bill_printed_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.last_customer_bill_printed_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN last_kitchen_bill_printed_at DATETIME');
    console.log('Orders table updated with last_kitchen_bill_printed_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.last_kitchen_bill_printed_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN edited_after_place TINYINT(1) NOT NULL DEFAULT 0');
    console.log('Orders table updated with edited_after_place');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.edited_after_place column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN last_edited_at DATETIME');
    console.log('Orders table updated with last_edited_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.last_edited_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN preparing_at DATETIME');
    console.log('Orders table updated with preparing_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.preparing_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN ready_at DATETIME');
    console.log('Orders table updated with ready_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.ready_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN served_at DATETIME');
    console.log('Orders table updated with served_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.served_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN cancelled_at DATETIME');
    console.log('Orders table updated with cancelled_at');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.cancelled_at column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE orders ADD COLUMN cancellation_reason VARCHAR(255)');
    console.log('Orders table updated with cancellation_reason');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring orders.cancellation_reason column:', error.message);
    }
  }

  try {
    await sequelize.query('ALTER TABLE order_items ADD COLUMN add_on_batch INTEGER NOT NULL DEFAULT 0');
    console.log('Order items table updated with add_on_batch');
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      console.error('Error ensuring order_items.add_on_batch column:', error.message);
    }
  }

  try {
    await sequelize.query(`
      UPDATE orders
      SET payment_recorded_at = CASE
        WHEN payment_received = 1 AND payment_recorded_at IS NULL THEN created_at
        ELSE payment_recorded_at
      END,
      table_cleared = COALESCE(table_cleared, 0),
      payment_status = CASE
        WHEN payment_received = 1 THEN 'paid'
        ELSE COALESCE(payment_status, 'pending')
      END,
      served_at = CASE
        WHEN status IN ('served', 'waiting_bill', 'completed') AND served_at IS NULL THEN created_at
        ELSE served_at
      END,
      cancelled_at = CASE
        WHEN status = 'cancelled' AND cancelled_at IS NULL THEN created_at
        ELSE cancelled_at
      END,
      ready_at = CASE
        WHEN status IN ('ready', 'served', 'waiting_bill', 'completed') AND ready_at IS NULL THEN created_at
        ELSE ready_at
      END,
      preparing_at = CASE
        WHEN status IN ('preparing', 'ready', 'served', 'waiting_bill', 'completed') AND preparing_at IS NULL THEN created_at
        ELSE preparing_at
      END
    `);
  } catch (error) {
    console.error('Error backfilling owner analytics order columns:', error.message);
  }
};

const bootstrap = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await connectDB();
      await sequelize.sync({ force: false });
      await ensureOrderHistoryColumns();
      console.log('Database synced');
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
};

module.exports = {
  bootstrap,
  ensureOrderHistoryColumns
};
