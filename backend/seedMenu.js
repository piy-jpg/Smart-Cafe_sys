const { Menu, sequelize } = require('./models');

const cafeItems = [
  // COFFEE - HOT (20)
  { name: 'Espresso', price: 2.50, category: 'Hot Coffee', available: true },
  { name: 'Double Espresso', price: 3.50, category: 'Hot Coffee', available: true },
  { name: 'Americano', price: 3.00, category: 'Hot Coffee', available: true },
  { name: 'Cappuccino', price: 4.50, category: 'Hot Coffee', available: true },
  { name: 'Latte', price: 4.50, category: 'Hot Coffee', available: true },
  { name: 'Macchiato', price: 3.75, category: 'Hot Coffee', available: true },
  { name: 'Mocha', price: 5.00, category: 'Hot Coffee', available: true },
  { name: 'Flat White', price: 4.00, category: 'Hot Coffee', available: true },
  { name: 'Cortado', price: 3.50, category: 'Hot Coffee', available: true },
  { name: 'Vanilla Latte', price: 5.00, category: 'Hot Coffee', available: true },
  { name: 'Caramel Macchiato', price: 5.00, category: 'Hot Coffee', available: true },
  { name: 'Hazelnut Latte', price: 5.00, category: 'Hot Coffee', available: true },
  { name: 'Café au Lait', price: 3.50, category: 'Hot Coffee', available: true },
  { name: 'Red Eye (Coffee + Espresso)', price: 4.50, category: 'Hot Coffee', available: true },
  { name: 'Black Eye (Coffee + 2x Espresso)', price: 5.50, category: 'Hot Coffee', available: true },
  { name: 'Irish Coffee', price: 8.00, category: 'Hot Coffee', available: true },
  { name: 'Turkish Coffee', price: 4.50, category: 'Hot Coffee', available: true },
  { name: 'White Chocolate Mocha', price: 5.25, category: 'Hot Coffee', available: true },
  { name: 'Cinnamon Dolce Latte', price: 5.00, category: 'Hot Coffee', available: true },
  { name: 'Pumpkin Spice Latte (Seasonal)', price: 5.50, category: 'Hot Coffee', available: true },

  // COFFEE - ICED (15)
  { name: 'Iced Coffee', price: 3.50, category: 'Iced Coffee', available: true },
  { name: 'Iced Latte', price: 4.50, category: 'Iced Coffee', available: true },
  { name: 'Iced Americano', price: 3.50, category: 'Iced Coffee', available: true },
  { name: 'Iced Mocha', price: 5.25, category: 'Iced Coffee', available: true },
  { name: 'Iced Caramel Macchiato', price: 5.25, category: 'Iced Coffee', available: true },
  { name: 'Cold Brew', price: 4.50, category: 'Iced Coffee', available: true },
  { name: 'Nitro Cold Brew', price: 5.50, category: 'Iced Coffee', available: true },
  { name: 'Iced Vanilla Latte', price: 5.00, category: 'Iced Coffee', available: true },
  { name: 'Iced Hazelnut Latte', price: 5.00, category: 'Iced Coffee', available: true },
  { name: 'Iced White Mocha', price: 5.50, category: 'Iced Coffee', available: true },
  { name: 'Cold Brew with Sweet Cream', price: 5.00, category: 'Iced Coffee', available: true },
  { name: 'Frappuccino - Caramel', price: 5.75, category: 'Iced Coffee', available: true },
  { name: 'Frappuccino - Mocha', price: 5.75, category: 'Iced Coffee', available: true },
  { name: 'Frappuccino - Vanilla', price: 5.50, category: 'Iced Coffee', available: true },
  { name: 'Affogato', price: 6.00, category: 'Iced Coffee', available: true },

  // TEA & NON-COFFEE (15)
  { name: 'English Breakfast Tea', price: 3.00, category: 'Tea', available: true },
  { name: 'Earl Grey Tea', price: 3.00, category: 'Tea', available: true },
  { name: 'Green Tea', price: 3.00, category: 'Tea', available: true },
  { name: 'Chamomile Tea', price: 3.00, category: 'Tea', available: true },
  { name: 'Peppermint Tea', price: 3.00, category: 'Tea', available: true },
  { name: 'Matcha Green Tea Latte', price: 5.00, category: 'Tea', available: true },
  { name: 'Chai Tea Latte', price: 4.75, category: 'Tea', available: true },
  { name: 'Dirty Chai (Chai + Espresso)', price: 5.75, category: 'Tea', available: true },
  { name: 'Iced Peach Tea', price: 3.50, category: 'Tea', available: true },
  { name: 'Iced Lemon Tea', price: 3.50, category: 'Tea', available: true },
  { name: 'Hot Chocolate', price: 4.00, category: 'Non-Coffee', available: true },
  { name: 'White Hot Chocolate', price: 4.50, category: 'Non-Coffee', available: true },
  { name: 'Steamed Milk', price: 2.50, category: 'Non-Coffee', available: true },
  { name: 'Fresh Orange Juice', price: 4.00, category: 'Non-Coffee', available: true },
  { name: 'Sparkling Water', price: 2.50, category: 'Non-Coffee', available: true },

  // PASTRIES & BAKERY (15)
  { name: 'Butter Croissant', price: 3.50, category: 'Bakery', available: true },
  { name: 'Chocolate Croissant', price: 4.00, category: 'Bakery', available: true },
  { name: 'Almond Croissant', price: 4.50, category: 'Bakery', available: true },
  { name: 'Blueberry Muffin', price: 3.50, category: 'Bakery', available: true },
  { name: 'Chocolate Chip Muffin', price: 3.50, category: 'Bakery', available: true },
  { name: 'Banana Nut Bread (Slice)', price: 3.50, category: 'Bakery', available: true },
  { name: 'Cinnamon Roll', price: 4.50, category: 'Bakery', available: true },
  { name: 'Bagel with Cream Cheese', price: 3.75, category: 'Bakery', available: true },
  { name: 'Everything Bagel', price: 3.75, category: 'Bakery', available: true },
  { name: 'Scone - Cranberry Orange', price: 3.50, category: 'Bakery', available: true },
  { name: 'Scone - Blueberry', price: 3.50, category: 'Bakery', available: true },
  { name: 'Brownie', price: 3.50, category: 'Bakery', available: true },
  { name: 'Chocolate Chip Cookie', price: 2.50, category: 'Bakery', available: true },
  { name: 'Oatmeal Raisin Cookie', price: 2.50, category: 'Bakery', available: true },
  { name: 'Macarons (Set of 3)', price: 6.00, category: 'Bakery', available: true },

  // BREAKFAST (10)
  { name: 'Avocado Toast', price: 8.50, category: 'Breakfast', available: true },
  { name: 'Bacon, Egg & Cheese Croissant', price: 7.50, category: 'Breakfast', available: true },
  { name: 'Sausage & Egg Muffin', price: 6.50, category: 'Breakfast', available: true },
  { name: 'Spinach & Feta Wrap', price: 7.00, category: 'Breakfast', available: true },
  { name: 'Greek Yogurt Parfait', price: 5.50, category: 'Breakfast', available: true },
  { name: 'Overnight Oats', price: 5.00, category: 'Breakfast', available: true },
  { name: 'Pancakes (Stack of 3)', price: 9.00, category: 'Breakfast', available: true },
  { name: 'French Toast', price: 9.50, category: 'Breakfast', available: true },
  { name: 'Breakfast Quesadilla', price: 8.00, category: 'Breakfast', available: true },
  { name: 'Fruit Bowl', price: 4.50, category: 'Breakfast', available: true },

  // SANDWICHES & SALADS (10)
  { name: 'Turkey & Swiss Sandwich', price: 9.50, category: 'Lunch', available: true },
  { name: 'Caprese Sandwich', price: 9.00, category: 'Lunch', available: true },
  { name: 'BLT Sandwich', price: 8.50, category: 'Lunch', available: true },
  { name: 'Grilled Cheese Sandwich', price: 6.50, category: 'Lunch', available: true },
  { name: 'Chicken Caesar Wrap', price: 9.50, category: 'Lunch', available: true },
  { name: 'Tuna Salad Sandwich', price: 8.50, category: 'Lunch', available: true },
  { name: 'Caesar Salad', price: 8.00, category: 'Lunch', available: true },
  { name: 'Greek Salad', price: 8.50, category: 'Lunch', available: true },
  { name: 'Quinoa Bowl', price: 10.00, category: 'Lunch', available: true },
  { name: 'Soup of the Day', price: 5.50, category: 'Lunch', available: true },

  // DESSERTS & CAKES (15)
  { name: 'New York Cheesecake', price: 6.50, category: 'Dessert', available: true },
  { name: 'Tiramisu', price: 7.00, category: 'Dessert', available: true },
  { name: 'Red Velvet Cake (Slice)', price: 6.50, category: 'Dessert', available: true },
  { name: 'Carrot Cake (Slice)', price: 6.50, category: 'Dessert', available: true },
  { name: 'Chocolate Lava Cake', price: 8.00, category: 'Dessert', available: true },
  { name: 'Lemon Tart', price: 5.50, category: 'Dessert', available: true },
  { name: 'Apple Pie (Slice)', price: 5.50, category: 'Dessert', available: true },
  { name: 'Pecan Pie (Slice)', price: 6.00, category: 'Dessert', available: true },
  { name: 'Key Lime Pie (Slice)', price: 6.00, category: 'Dessert', available: true },
  { name: 'Opera Cake', price: 7.50, category: 'Dessert', available: true },
  { name: 'Mille-Feuille', price: 7.00, category: 'Dessert', available: true },
  { name: 'Gelato - Vanilla', price: 4.50, category: 'Dessert', available: true },
  { name: 'Gelato - Chocolate', price: 4.50, category: 'Dessert', available: true },
  { name: 'Gelato - Pistachio', price: 5.00, category: 'Dessert', available: true },
  { name: 'Cannoli', price: 4.50, category: 'Dessert', available: true }
];

const seedDB = async () => {
  try {
    // We expect the models to be created already via server.js 'sync'
    // Let's clear the menu table to avoid duplicates if run multiple times
    await Menu.destroy({ where: {} });
    
    // Bulk create
    await Menu.bulkCreate(cafeItems);
    
    console.log('Successfully seeded 100 Cafe Menu Items!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding DB:', error);
    process.exit(1);
  }
};

seedDB();
