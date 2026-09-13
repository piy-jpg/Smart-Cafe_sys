const { Order, OrderItem, Menu, User } = require('../models');

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

const restockCancelledItems = async (orderId) => {
  const orderItems = await OrderItem.findAll({ where: { order_id: orderId } });

  for (const item of orderItems) {
    const menuItem = await Menu.findByPk(item.menu_id);
    if (!menuItem) continue;
    menuItem.stock_quantity += Number(item.quantity || 0);
    menuItem.available = menuItem.stock_quantity > 0;
    await menuItem.save();
  }
};

const getNextSerialNumber = async () => {
  const lastOrder = await Order.findOne({
    where: { serial_no: { [require('sequelize').Op.ne]: null } },
    order: [['serial_no', 'DESC']]
  });

  if (!lastOrder || !lastOrder.serial_no) return 1000;
  if (lastOrder.serial_no >= 9999) return 1000;
  return lastOrder.serial_no + 1;
};

exports.createOrder = async (req, res) => {
  try {
    const { table_number, table_label, items, waiter_id, customer_name, customer_phone } = req.body;
    
    // items should be an array of { menu_id, quantity }

    // Validate waiter_id exists to prevent foreign key constraint violations
    let validWaiterId = null;
    if (waiter_id) {
      const waiter = await User.findByPk(waiter_id);
      if (waiter) {
        validWaiterId = waiter.id;
      }
    }

    const order = await Order.create({
      table_number,
      table_label: table_label || null,
      serial_no: await getNextSerialNumber(),
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      table_cleared: false,
      status: 'pending',
      waiter_id: validWaiterId
    });

    for (let item of items) {
      const menuItem = await Menu.findByPk(item.menu_id);
      if (!menuItem) {
        return res.status(404).json({ success: false, message: 'Menu item not found' });
      }
      if (menuItem.stock_quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `${menuItem.name} is out of stock or low in stock` });
      }

      await OrderItem.create({
        order_id: order.id,
        menu_id: item.menu_id,
        add_on_batch: 0,
        quantity: item.quantity
      });

      menuItem.stock_quantity -= item.quantity;
      menuItem.available = menuItem.stock_quantity > 0;
      await menuItem.save();
    }

    // Fetch the complete order with items
    const completeOrder = await loadOrderWithRelations(order.id);

    // Broadcast new orders so kitchen and waiter-facing screens stay in sync.
    if (req.io) {
      req.io.emit('newOrder', completeOrder);
      req.io.emit('menuUpdated');
    }

    res.status(201).json({ success: true, order: completeOrder });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create order' });
  }
};

exports.addItemsToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [{ model: Menu, as: 'menu_item' }]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'ready' || order.status === 'served') {
      order.status = 'pending';
    }

    order.add_on_count = (order.add_on_count || 0) + 1;
    order.edited_after_place = true;
    order.last_edited_at = new Date();
    await order.save();

    for (const item of items) {
      const menuItem = await Menu.findByPk(item.menu_id);
      if (!menuItem) {
        return res.status(404).json({ success: false, message: 'Menu item not found' });
      }
      if (menuItem.stock_quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `${menuItem.name} is out of stock or low in stock` });
      }

      await OrderItem.create({
        order_id: order.id,
        menu_id: item.menu_id,
        add_on_batch: order.add_on_count,
        quantity: item.quantity
      });

      menuItem.stock_quantity -= item.quantity;
      menuItem.available = menuItem.stock_quantity > 0;
      await menuItem.save();
    }

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'items_added'
      });
      req.io.emit('menuUpdated');
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to add items to order' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
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
    res.json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

exports.updateOrderCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_phone, payment_method, payment_received, payment_status } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.customer_name = customer_name || null;
    order.customer_phone = customer_phone || null;
    order.payment_method = payment_method || null;
    if (payment_status !== undefined) {
      order.payment_status = payment_status || 'pending';
    }
    if (payment_received !== undefined) {
      order.payment_received = Boolean(payment_received);
      order.payment_recorded_at = payment_received ? new Date() : null;
      order.payment_status = payment_received ? 'paid' : 'pending';
    }
    await order.save();

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderCustomerUpdated', updatedOrder);
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update customer details' });
  }
};

exports.recordBillPrint = async (req, res) => {
  try {
    const { id } = req.params;
    const { bill_type } = req.body;

    if (!['customer', 'kitchen'].includes(bill_type)) {
      return res.status(400).json({ success: false, message: 'Valid bill_type is required' });
    }

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date();
    if (bill_type === 'customer') {
      order.customer_bill_print_count = (order.customer_bill_print_count || 0) + 1;
      order.last_customer_bill_printed_at = now;
    } else {
      order.kitchen_bill_print_count = (order.kitchen_bill_print_count || 0) + 1;
      order.last_kitchen_bill_printed_at = now;
    }
    await order.save();

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderCustomerUpdated', updatedOrder);
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to record bill print history' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, handover_target } = req.body; // 'pending', 'preparing', 'ready', 'served', 'waiting_bill', 'completed', 'cancelled'
    
    let order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const normalizedStatus = status === 'ready_for_billing' ? 'waiting_bill' : status;
    const now = new Date();
    const wasCancelled = order.status === 'cancelled';
    order.status = normalizedStatus;
    if (normalizedStatus !== 'completed' && normalizedStatus !== 'cancelled') {
      order.table_cleared = false;
    }
    if (normalizedStatus === 'preparing' && !order.preparing_at) order.preparing_at = now;
    if (normalizedStatus === 'ready' && !order.ready_at) order.ready_at = now;
    if (normalizedStatus === 'served') {
      if (!order.preparing_at) order.preparing_at = now;
      if (!order.ready_at) order.ready_at = now;
      order.served_at = now;
      if (handover_target !== undefined) {
        order.handover_target = handover_target || null;
      }
    }
    if (normalizedStatus === 'waiting_bill') {
      if (!order.preparing_at) order.preparing_at = now;
      if (!order.ready_at) order.ready_at = now;
      if (!order.served_at) order.served_at = now;
      order.payment_received = false;
      order.payment_status = 'pending';
      order.payment_recorded_at = null;
      order.table_cleared = false;
    }
    if (normalizedStatus === 'completed') {
      if (!order.preparing_at) order.preparing_at = now;
      if (!order.ready_at) order.ready_at = now;
      if (!order.served_at) order.served_at = now;
      order.payment_received = true;
      order.payment_status = 'paid';
      order.table_cleared = true;
      if (!order.payment_recorded_at) order.payment_recorded_at = now;
    }
    if (normalizedStatus === 'cancelled') {
      order.cancelled_at = now;
    }
    if (normalizedStatus !== 'served' && handover_target !== undefined) {
      order.handover_target = handover_target || null;
    }
    await order.save();

    if (normalizedStatus === 'cancelled' && !wasCancelled) {
      await restockCancelledItems(id);
    }

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderStatusUpdated', updatedOrder);
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'status_changed'
      });
      if (normalizedStatus === 'completed') {
        req.io.emit('tableCleared', updatedOrder);
      }
      req.io.emit('menuUpdated');
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

exports.settleFinalBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method = 'cash', discount_amount = 0 } = req.body;

    let order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date();
    if (!order.preparing_at) order.preparing_at = now;
    if (!order.ready_at) order.ready_at = now;
    if (!order.served_at) order.served_at = now;

    order.status = 'completed';
    order.payment_received = true;
    order.payment_status = 'paid';
    order.payment_method = payment_method;
    order.discount_amount = Number(discount_amount || 0);
    order.payment_recorded_at = now;
    order.table_cleared = true;

    await order.save();

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderStatusUpdated', updatedOrder);
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'final_bill_settled'
      });
      req.io.emit('orderCustomerUpdated', updatedOrder);
      req.io.emit('tableCleared', updatedOrder);
      req.io.emit('menuUpdated');
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Failed to settle final bill:', error);
    res.status(500).json({ success: false, message: 'Failed to settle final bill' });
  }
};

exports.returnToWaiter = async (req, res) => {
  try {
    const { id } = req.params;
    let order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'served';
    order.payment_received = false;
    order.payment_status = 'pending';
    order.table_cleared = false;

    await order.save();

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderStatusUpdated', updatedOrder);
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'returned_to_waiter'
      });
      req.io.emit('orderCustomerUpdated', updatedOrder);
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Failed to return table to waiter:', error);
    res.status(500).json({ success: false, message: 'Failed to return table to waiter' });
  }
};

exports.updateOrderOwnerControls = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      customer_phone,
      discount_amount,
      refund_amount,
      cancellation_reason,
      payment_method,
      payment_status,
      payment_received,
      table_cleared,
      waiter_id,
      status
    } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (discount_amount !== undefined) order.discount_amount = Number(discount_amount || 0);
    if (refund_amount !== undefined) order.refund_amount = Number(refund_amount || 0);
    if (cancellation_reason !== undefined) order.cancellation_reason = cancellation_reason || null;
    if (customer_name !== undefined) order.customer_name = customer_name || null;
    if (customer_phone !== undefined) order.customer_phone = customer_phone || null;
    if (payment_method !== undefined) order.payment_method = payment_method || null;
    if (payment_status !== undefined) order.payment_status = payment_status || 'pending';
    if (waiter_id !== undefined) order.waiter_id = waiter_id || null;
    if (table_cleared !== undefined) order.table_cleared = Boolean(table_cleared);
    if (payment_received !== undefined) {
      order.payment_received = Boolean(payment_received);
      order.payment_recorded_at = payment_received ? new Date() : null;
      order.payment_status = payment_received ? 'paid' : 'pending';
    }

    await order.save();

    if (status && status !== order.status) {
      req.body.status = status;
      return exports.updateOrderStatus(req, res);
    }

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'owner_controls'
      });
      req.io.emit('orderCustomerUpdated', updatedOrder);
      req.io.emit('systemControlUpdated');
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update owner controls' });
  }
};

exports.updateOrderTableClearState = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_cleared } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.table_cleared = Boolean(table_cleared);
    await order.save();

    const updatedOrder = await loadOrderWithRelations(id);

    if (req.io) {
      req.io.emit('orderUpdated', {
        ...updatedOrder.toJSON(),
        update_type: 'table_clear_state'
      });
      req.io.emit('orderCustomerUpdated', updatedOrder);
    }

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update table clear state' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [{ model: Menu, as: 'menu_item' }]
        }
      ]
    });
    
    let totalRevenue = 0;
    let totalOrders = orders.length;
    let completedOrders = 0;
    const topItemsMap = {};

    orders.forEach(order => {
      if (['served', 'waiting_bill', 'completed'].includes(order.status)) completedOrders++;
      
      order.items.forEach(item => {
        const itemTotal = parseFloat(item.menu_item?.price || 0) * item.quantity;
        totalRevenue += itemTotal;
        
        if (item.menu_item) {
          if (!topItemsMap[item.menu_item.name]) {
             topItemsMap[item.menu_item.name] = { name: item.menu_item.name, quantity: 0, revenue: 0 };
          }
          topItemsMap[item.menu_item.name].quantity += item.quantity;
          topItemsMap[item.menu_item.name].revenue += itemTotal;
        }
      });
    });

    const topSellingItems = Object.values(topItemsMap).sort((a,b) => b.quantity - a.quantity).slice(0, 5);

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        completedOrders,
        topSellingItems
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};
