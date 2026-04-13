const { Menu } = require('../models');

exports.getMenu = async (req, res) => {
  try {
    const includeUnavailable = req.query.includeUnavailable === 'true';
    const menu = await Menu.findAll(includeUnavailable ? {} : { where: { available: true, stock_quantity: { [require('sequelize').Op.gt]: 0 } } });
    res.json({ success: true, menu });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch menu' });
  }
};

exports.addMenuItem = async (req, res) => {
  try {
    const { name, price, category, image_url, item_type, stock_quantity, total_received } = req.body;
    const initialStock = Number(stock_quantity || 0);
    const receivedTotal = Number(total_received ?? initialStock);
    const newItem = await Menu.create({
      name,
      price,
      category,
      image_url: image_url || null,
      item_type: item_type || 'Veg',
      stock_quantity: initialStock,
      total_received: receivedTotal,
      available: initialStock > 0
    });
    
    if (req.io) req.io.emit('menuUpdated');

    res.status(201).json({ success: true, item: newItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to add menu item' });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, image_url, item_type, available, stock_quantity, total_received, restock_quantity } = req.body;
    
    let item = await Menu.findByPk(id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (name !== undefined) item.name = name;
    if (price !== undefined) item.price = price;
    if (category !== undefined) item.category = category;
    if (image_url !== undefined) item.image_url = image_url || null;
    if (item_type !== undefined) item.item_type = item_type || 'Veg';
    if (stock_quantity !== undefined) item.stock_quantity = Number(stock_quantity);
    if (total_received !== undefined) item.total_received = Number(total_received);
    if (restock_quantity !== undefined) {
      const restock = Number(restock_quantity);
      item.stock_quantity += restock;
      item.total_received += restock;
    }
    if (available !== undefined) item.available = available;
    if (stock_quantity !== undefined || restock_quantity !== undefined) {
      item.available = item.stock_quantity > 0;
    }

    await item.save();

    if (req.io) req.io.emit('menuUpdated');

    res.json({ success: true, item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update menu item' });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Menu.findByPk(id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    
    await item.destroy();

    if (req.io) req.io.emit('menuUpdated');

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to delete menu item' });
  }
};
