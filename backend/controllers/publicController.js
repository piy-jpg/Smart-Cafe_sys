const QRCode = require('qrcode');
const { Op } = require('sequelize');
const { Order, OrderItem, Menu, User } = require('../models');

const PUBLIC_RESTAURANT_CODE = process.env.PUBLIC_RESTAURANT_CODE || 'smartcafe_main';
const DEFAULT_PUBLIC_APP_URL = process.env.PUBLIC_ORDER_APP_URL || 'http://localhost:6003';
const SESSION_LIMIT_ITEMS = 25;

const normalizeAppUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch (error) {
    return '';
  }
};

const loadOrderWithRelations = (id) => Order.findByPk(id, {
  include: [
    { model: User, as: 'waiter', attributes: ['id', 'name', 'role'] },
    {
      model: OrderItem,
      as: 'items',
      include: [{ model: Menu, as: 'menu_item' }]
    }
  ]
});

const getNextSerialNumber = async () => {
  const lastOrder = await Order.findOne({
    where: { serial_no: { [Op.ne]: null } },
    order: [['serial_no', 'DESC']]
  });

  if (!lastOrder || !lastOrder.serial_no) return 1000;
  if (lastOrder.serial_no >= 9999) return 1000;
  return lastOrder.serial_no + 1;
};

const isValidRestaurant = (restaurantCode) => restaurantCode === PUBLIC_RESTAURANT_CODE;

const resolvePublicAppUrl = (req) => {
  const explicitUrl = normalizeAppUrl(req.query.appUrl || req.body?.appUrl);
  if (explicitUrl) return explicitUrl;

  const requestOrigin = req.get('origin');
  const normalizedOrigin = normalizeAppUrl(requestOrigin);
  if (normalizedOrigin) return normalizedOrigin;

  const forwardedProto = String(req.get('x-forwarded-proto') || '').trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '').trim();
  if (forwardedProto && forwardedHost) {
    const forwardedUrl = normalizeAppUrl(`${forwardedProto}://${forwardedHost}`);
    if (forwardedUrl) return forwardedUrl;
  }

  const host = String(req.get('host') || '').trim();
  if (host) {
    const requestUrl = normalizeAppUrl(`${req.protocol}://${host}`);
    if (requestUrl) return requestUrl;
  }

  return normalizeAppUrl(DEFAULT_PUBLIC_APP_URL) || DEFAULT_PUBLIC_APP_URL.replace(/\/+$/, '');
};

const createOrderItems = async (order, items, addOnBatch = 0) => {
  for (const item of items) {
    const menuItem = await Menu.findByPk(item.menu_id);
    if (!menuItem) {
      throw new Error(`Menu item ${item.menu_id} not found`);
    }

    const quantity = Number(item.quantity || item.qty || 0);
    if (!quantity || quantity < 1) {
      throw new Error(`Invalid quantity for ${menuItem.name}`);
    }

    if (Number(menuItem.stock_quantity || 0) < quantity) {
      throw new Error(`${menuItem.name} is out of stock or low in stock`);
    }

    await OrderItem.create({
      order_id: order.id,
      menu_id: item.menu_id,
      add_on_batch: addOnBatch,
      quantity
    });

    menuItem.stock_quantity -= quantity;
    menuItem.available = menuItem.stock_quantity > 0;
    await menuItem.save();
  }
};

exports.getPublicMenu = async (req, res) => {
  try {
    const restaurantCode = String(req.query.restaurant || req.query.res || PUBLIC_RESTAURANT_CODE).trim();
    const tableNumber = Number(req.query.table || 0);

    if (!isValidRestaurant(restaurantCode)) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const menu = await Menu.findAll({
      where: {
        available: true,
        stock_quantity: { [Op.gt]: 0 }
      },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      menu,
      meta: {
        restaurantCode,
        tableNumber
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch public menu' });
  }
};

exports.createPublicOrder = async (req, res) => {
  try {
    const restaurantCode = String(req.body.restaurantCode || req.body.res || '').trim();
    const tableNumber = Number(req.body.tableNumber);
    const sessionId = String(req.body.sessionId || '').trim();
    const customerName = String(req.body.customerName || '').trim() || null;
    const customerPhone = String(req.body.customerPhone || '').trim() || null;
    const paymentMethod = String(req.body.paymentMethod || '').trim() || 'pay_at_counter';
    const specialInstructions = String(req.body.specialInstructions || '').trim() || null;
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!isValidRestaurant(restaurantCode)) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      return res.status(400).json({ success: false, message: 'Valid table number is required' });
    }

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const totalRequestedItems = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0);
    if (totalRequestedItems > SESSION_LIMIT_ITEMS) {
      return res.status(429).json({ success: false, message: 'Too many items in one request' });
    }

    let order = await Order.findOne({
      where: {
        restaurant_code: restaurantCode,
        table_number: tableNumber,
        status: { [Op.notIn]: ['served', 'cancelled'] }
      },
      order: [['created_at', 'DESC']]
    });

    if (order) {
      if (order.status === 'ready') {
        order.status = 'pending';
      }
      order.session_id = sessionId;
      order.customer_name = customerName || order.customer_name;
      order.customer_phone = customerPhone || order.customer_phone;
      order.payment_method = paymentMethod || order.payment_method;
      order.special_instructions = specialInstructions || order.special_instructions;
      order.order_source = 'qr';
      order.add_on_count = Number(order.add_on_count || 0) + 1;
      order.edited_after_place = true;
      order.last_edited_at = new Date();
      await order.save();

      await createOrderItems(order, items, order.add_on_count);

      const updatedOrder = await loadOrderWithRelations(order.id);
      if (req.io) {
        req.io.emit('orderUpdated', {
          ...updatedOrder.toJSON(),
          update_type: 'qr_items_added'
        });
        req.io.emit('menuUpdated');
      }

      return res.json({ success: true, order: updatedOrder, mergedIntoExisting: true });
    }

    order = await Order.create({
      restaurant_code: restaurantCode,
      session_id: sessionId,
      order_source: 'qr',
      table_number: tableNumber,
      table_label: `Table ${tableNumber}`,
      serial_no: await getNextSerialNumber(),
      customer_name: customerName,
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      special_instructions: specialInstructions,
      status: 'pending',
      waiter_id: null
    });

    await createOrderItems(order, items, 0);

    const completeOrder = await loadOrderWithRelations(order.id);
    if (req.io) {
      req.io.emit('newOrder', completeOrder);
      req.io.emit('menuUpdated');
    }

    res.status(201).json({ success: true, order: completeOrder, mergedIntoExisting: false });
  } catch (error) {
    console.error(error);
    const message = String(error.message || '');
    if (message.includes('not found') || message.includes('stock')) {
      return res.status(400).json({ success: false, message });
    }
    res.status(500).json({ success: false, message: 'Failed to place QR order' });
  }
};

exports.getPublicOrderStatus = async (req, res) => {
  try {
    const restaurantCode = String(req.query.restaurant || req.query.res || '').trim();
    const tableNumber = Number(req.query.table || 0);
    const sessionId = String(req.query.sessionId || '').trim();

    if (!isValidRestaurant(restaurantCode)) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const where = {
      restaurant_code: restaurantCode,
      table_number: tableNumber
    };

    if (sessionId) {
      where.session_id = sessionId;
    }

    const order = await Order.findOne({
      where,
      include: [
        { model: User, as: 'waiter', attributes: ['id', 'name', 'role'] },
        {
          model: OrderItem,
          as: 'items',
          include: [{ model: Menu, as: 'menu_item' }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, order: order || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch order status' });
  }
};

exports.getTableQrCodes = async (req, res) => {
  try {
    const restaurantCode = String(req.query.restaurant || req.query.res || PUBLIC_RESTAURANT_CODE).trim();
    const tableCount = Math.max(1, Math.min(50, Number(req.query.tables || 10)));

    if (!isValidRestaurant(restaurantCode)) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const baseUrl = resolvePublicAppUrl(req);
    const tables = await Promise.all(
      Array.from({ length: tableCount }, async (_, index) => {
        const tableNumber = index + 1;
        const url = `${baseUrl}/order?res=${encodeURIComponent(restaurantCode)}&table=${tableNumber}`;
        const qrImage = await QRCode.toDataURL(url, {
          margin: 1,
          width: 280
        });

        return {
          table_number: tableNumber,
          qr_url: url,
          qr_image: qrImage
        };
      })
    );

    res.json({ success: true, tables, restaurantCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to generate table QR codes' });
  }
};
