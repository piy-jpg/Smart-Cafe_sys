const { sequelize, Menu } = require('../models');

const compactMenuItems = [
  { name: 'Espresso', category: 'Hot Coffee', price: 2.55, stock_quantity: 30 },
  { name: 'Cappuccino', category: 'Hot Coffee', price: 4.5, stock_quantity: 30 },
  { name: 'Latte', category: 'Hot Coffee', price: 4.5, stock_quantity: 30 },

  { name: 'Iced Coffee', category: 'Iced Coffee', price: 3.5, stock_quantity: 30 },
  { name: 'Iced Latte', category: 'Iced Coffee', price: 4.5, stock_quantity: 30 },
  { name: 'Cold Brew', category: 'Iced Coffee', price: 4.5, stock_quantity: 30 },

  { name: 'English Breakfast Tea', category: 'Tea', price: 3, stock_quantity: 30 },
  { name: 'Green Tea', category: 'Tea', price: 3, stock_quantity: 30 },
  { name: 'Masala Chai', category: 'Tea', price: 3.5, stock_quantity: 30 },

  { name: 'Classic Pancakes', category: 'Breakfast', price: 6.5, stock_quantity: 30 },
  { name: 'Veg Omelette Toast', category: 'Breakfast', price: 6.9, stock_quantity: 30 },
  { name: 'Breakfast Burrito', category: 'Breakfast', price: 7.4, stock_quantity: 30 },

  { name: 'Club Sandwich', category: 'Lunch', price: 8.5, stock_quantity: 30 },
  { name: 'Grilled Chicken Sandwich', category: 'Lunch', price: 9.2, stock_quantity: 30 },
  { name: 'Veggie Wrap', category: 'Lunch', price: 8.1, stock_quantity: 30 },

  { name: 'Blueberry Muffin', category: 'Bakery', price: 3.2, stock_quantity: 30 },
  { name: 'Butter Croissant', category: 'Bakery', price: 3.5, stock_quantity: 30 },
  { name: 'Chocolate Danish', category: 'Bakery', price: 3.8, stock_quantity: 30 },

  { name: 'Cheesecake Slice', category: 'Dessert', price: 5.5, stock_quantity: 30 },
  { name: 'Chocolate Brownie', category: 'Dessert', price: 4.8, stock_quantity: 30 },
  { name: 'Tiramisu Cup', category: 'Dessert', price: 5.9, stock_quantity: 30 },

  { name: 'Classic Lemonade', category: 'Refreshers', price: 4.2, stock_quantity: 30 },
  { name: 'Mint Lime Refresher', category: 'Refreshers', price: 4.8, stock_quantity: 30 },
  { name: 'Watermelon Basil Splash', category: 'Refreshers', price: 5.2, stock_quantity: 30 },

  { name: 'Mango Tango Smoothie', category: 'Smoothies', price: 6.5, stock_quantity: 30 },
  { name: 'Berry Power Smoothie', category: 'Smoothies', price: 6.75, stock_quantity: 30 },
  { name: 'Green Glow Smoothie', category: 'Smoothies', price: 6.9, stock_quantity: 30 },

  { name: 'Classic Vanilla Milkshake', category: 'Milkshakes', price: 6.2, stock_quantity: 30 },
  { name: 'Chocolate Fudge Milkshake', category: 'Milkshakes', price: 6.6, stock_quantity: 30 },
  { name: 'Strawberry Cream Milkshake', category: 'Milkshakes', price: 6.4, stock_quantity: 30 }
];

const main = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  const keepKeys = new Set(compactMenuItems.map((item) => `${item.name}::${item.category}`));
  const existingItems = await Menu.findAll();

  let createdCount = 0;
  let updatedCount = 0;
  let hiddenCount = 0;

  for (const menuItem of existingItems) {
    const key = `${menuItem.name}::${menuItem.category}`;
    if (!keepKeys.has(key) && menuItem.available !== false) {
      menuItem.available = false;
      await menuItem.save();
      hiddenCount += 1;
    }
  }

  for (const item of compactMenuItems) {
    const existing = existingItems.find((menuItem) => (
      menuItem.name === item.name && menuItem.category === item.category
    ));

    if (existing) {
      existing.price = item.price;
      existing.stock_quantity = item.stock_quantity;
      existing.total_received = Math.max(Number(existing.total_received || 0), item.stock_quantity);
      existing.available = true;
      await existing.save();
      updatedCount += 1;
      continue;
    }

    await Menu.create({
      ...item,
      total_received: item.stock_quantity,
      available: true
    });
    createdCount += 1;
  }

  console.log(`Compact menu ready. Created ${createdCount}, updated ${updatedCount}, hidden ${hiddenCount}.`);
  await sequelize.close();
};

main().catch(async (error) => {
  console.error('Failed to set compact menu:', error.message);
  try {
    await sequelize.close();
  } catch (_error) {
    // no-op
  }
  process.exit(1);
});
