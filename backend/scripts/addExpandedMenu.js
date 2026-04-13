const { sequelize, Menu } = require('../models');

const expandedMenuItems = [
  { name: 'Mango Tango Smoothie', category: 'Smoothies', price: 6.5, stock_quantity: 30 },
  { name: 'Berry Power Smoothie', category: 'Smoothies', price: 6.75, stock_quantity: 30 },
  { name: 'Green Glow Smoothie', category: 'Smoothies', price: 6.9, stock_quantity: 30 },

  { name: 'Mint Lime Refresher', category: 'Refreshers', price: 4.8, stock_quantity: 30 },
  { name: 'Cucumber Citrus Cooler', category: 'Refreshers', price: 5.1, stock_quantity: 30 },
  { name: 'Watermelon Basil Splash', category: 'Refreshers', price: 5.2, stock_quantity: 30 },

  { name: 'Classic Vanilla Milkshake', category: 'Milkshakes', price: 6.2, stock_quantity: 30 },
  { name: 'Chocolate Fudge Milkshake', category: 'Milkshakes', price: 6.6, stock_quantity: 30 },
  { name: 'Strawberry Cream Milkshake', category: 'Milkshakes', price: 6.4, stock_quantity: 30 },

  { name: 'Paneer Tikka Wrap', category: 'Wraps', price: 8.4, stock_quantity: 30 },
  { name: 'Peri Peri Chicken Wrap', category: 'Wraps', price: 8.9, stock_quantity: 30 },
  { name: 'Falafel Hummus Wrap', category: 'Wraps', price: 8.2, stock_quantity: 30 },

  { name: 'Cafe Smash Burger', category: 'Burgers', price: 9.5, stock_quantity: 30 },
  { name: 'Spicy Crispy Chicken Burger', category: 'Burgers', price: 9.9, stock_quantity: 30 },
  { name: 'Veggie Melt Burger', category: 'Burgers', price: 8.9, stock_quantity: 30 },

  { name: 'Creamy Alfredo Pasta', category: 'Pasta', price: 10.5, stock_quantity: 30 },
  { name: 'Arrabbiata Penne Pasta', category: 'Pasta', price: 10.2, stock_quantity: 30 },
  { name: 'Pesto Garden Fusilli', category: 'Pasta', price: 10.8, stock_quantity: 30 },

  { name: 'Margherita Cafe Pizza', category: 'Pizza', price: 11.5, stock_quantity: 30 },
  { name: 'Farmhouse Crunch Pizza', category: 'Pizza', price: 12.2, stock_quantity: 30 },
  { name: 'Smoky Chicken Pizza', category: 'Pizza', price: 12.8, stock_quantity: 30 },

  { name: 'Caesar Crunch Salad', category: 'Salads', price: 7.9, stock_quantity: 30 },
  { name: 'Mediterranean Bowl Salad', category: 'Salads', price: 8.2, stock_quantity: 30 },
  { name: 'Quinoa Rainbow Salad', category: 'Salads', price: 8.4, stock_quantity: 30 },

  { name: 'Sunset Berry Mocktail', category: 'Mocktails', price: 5.6, stock_quantity: 30 },
  { name: 'Citrus Spark Mocktail', category: 'Mocktails', price: 5.4, stock_quantity: 30 },
  { name: 'Blue Lagoon Mocktail', category: 'Mocktails', price: 5.8, stock_quantity: 30 },
  { name: 'Passion Fruit Mojito', category: 'Mocktails', price: 5.9, stock_quantity: 30 },

  { name: 'Caramel Crunch Waffle', category: 'Waffles', price: 7.1, stock_quantity: 30 },
  { name: 'Berries and Cream Waffle', category: 'Waffles', price: 7.4, stock_quantity: 30 },
  { name: 'Nutella Banana Waffle', category: 'Waffles', price: 7.8, stock_quantity: 30 },
  { name: 'Maple Butter Waffle', category: 'Waffles', price: 7.2, stock_quantity: 30 },

  { name: 'Triple Chocolate Sundae', category: 'Sundaes', price: 6.8, stock_quantity: 30 },
  { name: 'Mango Pistachio Sundae', category: 'Sundaes', price: 7.0, stock_quantity: 30 },
  { name: 'Cookies and Cream Sundae', category: 'Sundaes', price: 7.1, stock_quantity: 30 },
  { name: 'Brownie Blast Sundae', category: 'Sundaes', price: 7.4, stock_quantity: 30 },

  { name: 'Tropical Dragon Fruit Smoothie', category: 'Smoothies', price: 7.1, stock_quantity: 30 },
  { name: 'Cold Coffee Protein Shake', category: 'Milkshakes', price: 6.9, stock_quantity: 30 }
];

const main = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of expandedMenuItems) {
    const existing = await Menu.findOne({
      where: { name: item.name, category: item.category }
    });

    if (existing) {
      existing.price = item.price;
      existing.stock_quantity = Math.max(Number(existing.stock_quantity || 0), item.stock_quantity);
      existing.total_received = Math.max(Number(existing.total_received || 0), item.stock_quantity);
      existing.available = existing.stock_quantity > 0;
      await existing.save();
      updatedCount += 1;
      continue;
    }

    await Menu.create({
      ...item,
      total_received: item.stock_quantity,
      available: item.stock_quantity > 0
    });
    createdCount += 1;
  }

  console.log(`Expanded menu complete. Created ${createdCount} items, updated ${updatedCount} items.`);
  await sequelize.close();
};

main().catch(async (error) => {
  console.error('Failed to add expanded menu:', error.message);
  try {
    await sequelize.close();
  } catch (_error) {
    // no-op
  }
  process.exit(1);
});
