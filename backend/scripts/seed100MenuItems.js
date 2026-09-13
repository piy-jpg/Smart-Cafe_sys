const { sequelize, Menu } = require('../models');

const menu100Items = [
  // 1. HOT COFFEE (10 items)
  {
    name: 'Classic Espresso',
    category: 'Hot Coffee',
    price: 120,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Bold single shot of rich Italian roast espresso with a dense golden-hazelnut crema.',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Double Espresso Shot',
    category: 'Hot Coffee',
    price: 160,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Intense doppio shot crafted from 100% Arabica dark roast beans for a deep caffeine boost.',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Caffe Americano',
    category: 'Hot Coffee',
    price: 150,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Rich espresso shots diluted with hot mountain spring water, delivering a smooth, bold aroma.',
    image_url: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Creamy Cappuccino',
    category: 'Hot Coffee',
    price: 180,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Equal parts espresso, steamed whole milk, and deep velvety froth dusted with organic cocoa.',
    image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Classic Cafe Latte',
    category: 'Hot Coffee',
    price: 190,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Smooth double espresso balanced with steamed milk and a delicate top layer of microfoam latte art.',
    image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Flat White Reserve',
    category: 'Hot Coffee',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Double ristretto shot blended seamlessly with velvety steamed microfoam milk for a strong, silky sip.',
    image_url: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Dark Chocolate Mocha',
    category: 'Hot Coffee',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Rich espresso combined with melted dark Belgian chocolate, steamed milk, and cocoa dust.',
    image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Caramel Macchiato',
    category: 'Hot Coffee',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Freshly steamed vanilla-infused milk marked with bold espresso shots and drizzled with buttery caramel.',
    image_url: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Hazelnut Creme Latte',
    category: 'Hot Coffee',
    price: 230,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Rich double espresso infused with roasted hazelnut syrup, velvety steamed milk, and toasted hazelnut sprinkles.',
    image_url: 'https://images.unsplash.com/photo-1585494156145-1c60a4fe9d2b?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Spanish Cortado',
    category: 'Hot Coffee',
    price: 170,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Equal parts robust espresso and silky warm milk, served in a glass to balance boldness and sweetness.',
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80'
  },

  // 2. ICED COFFEE (10 items)
  {
    name: 'Classic Iced Coffee',
    category: 'Iced Coffee',
    price: 160,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Freshly brewed Arabica blend poured over crystal ice blocks with a dash of simple syrup.',
    image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Iced Americano Splash',
    category: 'Iced Coffee',
    price: 170,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Double shot espresso poured over crisp chilled water and ice, crisp, clean, and revitalizing.',
    image_url: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Iced Vanilla Latte',
    category: 'Iced Coffee',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Chilled espresso shaken with Madagascar vanilla bean syrup, fresh milk, and served over ice cubes.',
    image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Cold Brew Reserve',
    category: 'Iced Coffee',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 45,
    description: '18-hour cold steeped single-origin beans resulting in an ultra-smooth, low-acidity coffee.',
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Nitro Smooth Cold Brew',
    category: 'Iced Coffee',
    price: 250,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Nitrogen-infused slow brew poured on tap with a cascading creamy head and velvet mouthfeel.',
    image_url: 'https://images.unsplash.com/photo-1524350876685-274059332603?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Caramel Frappuccino',
    category: 'Iced Coffee',
    price: 260,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Blended icy coffee beverage whipped with caramel drizzle, creamy milk, and whipped vanilla topping.',
    image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Mocha Chocochip Frappe',
    category: 'Iced Coffee',
    price: 270,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Ice-blended espresso with Belgian chocolate chunks, whole milk, and chocolate swirl cream.',
    image_url: 'https://images.unsplash.com/photo-1579888944880-d98341245702?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sweet Cream Cold Brew',
    category: 'Iced Coffee',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Slow-steeped cold brew topped with a float of house-made vanilla sweet cream.',
    image_url: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Vietnamese Condensed Iced Coffee',
    category: 'Iced Coffee',
    price: 230,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Strong dark roast dripped over sweet condensed milk and stirred over crushed ice.',
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Espresso Affogato al Caffe',
    category: 'Iced Coffee',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Two scoops of artisan Madagascar vanilla gelato drowned in a hot shot of fresh espresso.',
    image_url: 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?auto=format&fit=crop&w=600&q=80'
  },

  // 3. TEA & INFUSIONS (10 items)
  {
    name: 'Royal Masala Chai',
    category: 'Tea',
    price: 90,
    item_type: 'Veg',
    stock_quantity: 60,
    description: 'Slow-brewed Assam CTC black tea with crushed cardamom, fresh ginger, cinnamon, and whole milk.',
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Ginger Cardamom Kadak Chai',
    category: 'Tea',
    price: 100,
    item_type: 'Veg',
    stock_quantity: 60,
    description: 'Robust street-style Indian kadak chai brewed with fiery ginger root and fragrant green cardamom.',
    image_url: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'English Breakfast Gold Tea',
    category: 'Tea',
    price: 140,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Pure Ceylon orthodox whole leaf black tea, bright and full-bodied with rich malt notes.',
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Earl Grey Lavender Tea',
    category: 'Tea',
    price: 150,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Fine black tea scented with cold-pressed Italian bergamot oil and dried blue lavender petals.',
    image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Kyoto Matcha Green Latte',
    category: 'Tea',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Ceremonial grade stone-ground Uji matcha whisked with warm creamy milk and a touch of cane sugar.',
    image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Jasmine Blossom Green Tea',
    category: 'Tea',
    price: 150,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Delicate green tea leaves scented with freshly plucked night-blooming jasmine flowers.',
    image_url: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Chamomile Honey Infusion',
    category: 'Tea',
    price: 160,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Whole soothing chamomile blossoms steeped with wildflower honey and fresh lemon zest. Caffeine free.',
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Lemon Honey Ginger Tea',
    category: 'Tea',
    price: 140,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Freshly squeezed lemon juice, crushed root ginger, and organic forest honey in hot mountain water.',
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sun-Drenched Iced Peach Tea',
    category: 'Tea',
    price: 170,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Chilled black tea infused with sweet peach nectar, garden mint leaves, and ice slices.',
    image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Hibiscus Mint Sparkler Tea',
    category: 'Tea',
    price: 180,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Tart crimson hibiscus flower infusion paired with fresh garden mint and bubbly soda.',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
  },

  // 4. MOCKTAILS & REFRESHERS (10 items)
  {
    name: 'Fresh Mint Lime Mojito',
    category: 'Mocktails',
    price: 180,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Crisp muddled fresh mint leaves, lime wedges, and raw cane sugar topped with crushed ice and soda.',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Blue Ocean Lagoon Cooler',
    category: 'Mocktails',
    price: 190,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Vibrant blue curacao syrup shaken with tangy lime juice, sprite, and sparkling mineral soda.',
    image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Watermelon Basil Cooler',
    category: 'Mocktails',
    price: 200,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Freshly cold-pressed sweet watermelon juice shaken with aromatic sweet basil and cracked ice.',
    image_url: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Passion Fruit Fizz Spritzer',
    category: 'Mocktails',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Exotic yellow passion fruit puree layered with citrus soda and floating mint springs.',
    image_url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Crisp Green Apple Fizz',
    category: 'Mocktails',
    price: 190,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Granny smith green apple reduction, crushed ice, fresh lime, and effervescent sparkling water.',
    image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sunset Berry Punch',
    category: 'Mocktails',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Layered medley of wild raspberry, strawberry, and cranberry juices with a refreshing citrus fizz.',
    image_url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Chili Guava Sparkler',
    category: 'Mocktails',
    price: 190,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Pink guava nectar shaken with black salt, a dash of red chili powder, and chilled ginger ale.',
    image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Cucumber Mint Lemonade',
    category: 'Mocktails',
    price: 160,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Cooling fresh cucumber ribbons, spearmint leaves, and freshly squeezed lemon juice over ice.',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Peach Apricot Breeze',
    category: 'Mocktails',
    price: 200,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Sweet stone fruit puree blended with chilled white grape juice and fizzy sparkling water.',
    image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Strawberry Basil Sparkler',
    category: 'Mocktails',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Muddled garden strawberries and peppery basil leaves lengthened with chilled club soda.',
    image_url: 'https://images.unsplash.com/photo-1587888637140-849b25d80ef9?auto=format&fit=crop&w=600&q=80'
  },

  // 5. BREAKFAST & EGGS (10 items)
  {
    name: 'Fluffy Buttermilk Pancakes',
    category: 'Breakfast',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Stack of three golden buttermilk pancakes served with melted farm butter and pure Canadian maple syrup.',
    image_url: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Belgian Golden Waffle',
    category: 'Breakfast',
    price: 260,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Authentic crisp exterior pearl sugar waffle served with whipped mascarpone cream and berry compote.',
    image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Smashed Avocado Sourdough Toast',
    category: 'Breakfast',
    price: 320,
    item_type: 'Veg',
    stock_quantity: 35,
    description: 'Hass avocado tossed with chili flakes, Greek feta crumbles, and olive oil on toasted artisan sourdough.',
    image_url: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Spicy Masala Scrambled Eggs',
    category: 'Breakfast',
    price: 190,
    item_type: 'Non Veg',
    stock_quantity: 45,
    description: 'Farm fresh eggs scrambled with chopped onions, green chilies, tomatoes, cilantro, and toasted sourdough.',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Cheese Mushroom Stuffed Omelette',
    category: 'Breakfast',
    price: 220,
    item_type: 'Non Veg',
    stock_quantity: 45,
    description: 'Three-egg fluffy folded omelette stuffed with sautéed button mushrooms, mozzarella, and sharp cheddar.',
    image_url: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Greek Honey Yogurt Granola Parfait',
    category: 'Breakfast',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Thick Greek strained yogurt layered with toasted almond granola, chia seeds, and wild forest honey.',
    image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Brioche Cinnamon French Toast',
    category: 'Breakfast',
    price: 250,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Golden brioche slices dipped in vanilla egg custard, pan-griddled and dusted with cinnamon cane sugar.',
    image_url: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Paneer Bhurji & Butter Toast',
    category: 'Breakfast',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Crumbled cottage cheese sautéed with fragrant spices, turmeric, and served with hot buttered toast.',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Crispy Hash Brown Stack',
    category: 'Breakfast',
    price: 180,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Golden shredded potato patties fried extra crisp, sprinkled with sea salt and served with tomato relish.',
    image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Mediterranean Shakshuka Skillet',
    category: 'Breakfast',
    price: 280,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Poached farm eggs nestled in a spiced bell pepper, onion, and cumin-tomato sauce with warm pita bread.',
    image_url: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=600&q=80'
  },

  // 6. BURGERS & SANDWICHES (10 items)
  {
    name: 'Classic Cafe Veggie Burger',
    category: 'Burgers',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Crisp vegetable patty layered with cheddar cheese, crisp lettuce, red onion, and secret sauce on brioche.',
    image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Crispy Paneer Makhani Burger',
    category: 'Burgers',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Panko-crusted spiced cottage cheese patty glazed with creamy makhani sauce and fresh mint mayo.',
    image_url: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Golden Crispy Chicken Burger',
    category: 'Burgers',
    price: 280,
    item_type: 'Non Veg',
    stock_quantity: 40,
    description: 'Hand-breaded buttermilk chicken breast fried golden crisp with pickled jalapeños and garlic mayo.',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Double Cheese Bacon Smash Burger',
    category: 'Burgers',
    price: 340,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Twin grilled patties smashed on the griddle with melted American cheese, crisp bacon, and house spread.',
    image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Peri Peri Flame-Grilled Chicken Burger',
    category: 'Burgers',
    price: 290,
    item_type: 'Non Veg',
    stock_quantity: 40,
    description: 'Char-grilled chicken breast basted in fiery African bird\'s eye chili marinade with crisp slaw.',
    image_url: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Wild Mushroom Swiss Melt Burger',
    category: 'Burgers',
    price: 260,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Sautéed portobello and button mushrooms topped with melted Swiss Gruyere and caramelized onions.',
    image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Smoky BBQ Tex-Mex Bean Burger',
    category: 'Burgers',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Black bean and corn patty infused with chipotle peppers, smoked gouda, and BBQ glaze.',
    image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Crispy Fish Fillet Tartar Burger',
    category: 'Burgers',
    price: 310,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Golden crumbed white fish fillet topped with tangy caper-dill tartar sauce and iceberg lettuce.',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'BBQ Pulled Chicken Sliders',
    category: 'Burgers',
    price: 320,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Trio of soft mini brioche buns stuffed with slow-cooked shredded BBQ chicken and apple slaw.',
    image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Truffle Mac & Cheese Stuffed Burger',
    category: 'Burgers',
    price: 290,
    item_type: 'Veg',
    stock_quantity: 35,
    description: 'Crispy veggie patty topped with creamy four-cheese macaroni and a drizzle of white truffle oil.',
    image_url: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=600&q=80'
  },

  // 7. PIZZA (10 items)
  {
    name: 'Margherita Basilico Pizza',
    category: 'Pizza',
    price: 320,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Neapolitan crust with San Marzano tomato sauce, fresh buffalo mozzarella, olive oil, and sweet basil.',
    image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Farmhouse Garden Supreme Pizza',
    category: 'Pizza',
    price: 380,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Thin crust topped with bell peppers, sweet corn, black olives, red onions, and mozzarella cheese.',
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Paneer Tikka Fusion Pizza',
    category: 'Pizza',
    price: 420,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Charcoal-tandoori cottage cheese cubes, charred capsicum, pickled onion, and spicy tomato reduction.',
    image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Four Cheese Formaggi Pizza',
    category: 'Pizza',
    price: 440,
    item_type: 'Veg',
    stock_quantity: 35,
    description: 'White garlic olive oil base layered with mozzarella, gorgonzola, fontina, and aged parmigiano-reggiano.',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'BBQ Chicken & Red Onion Pizza',
    category: 'Pizza',
    price: 460,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Smoked chicken breast chunks tossed in tangy barbecue sauce with sliced red onions and mozzarella.',
    image_url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Spicy Peri Peri Chicken Feast Pizza',
    category: 'Pizza',
    price: 470,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Fiery peri peri chicken, roasted red peppers, jalapeños, mozzarella, and chili flakes.',
    image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Smoked Chicken Pepperoni Pizza',
    category: 'Pizza',
    price: 490,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Generously topped with artisan smoked chicken pepperoni slices, oregano, and bubbling mozzarella.',
    image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Wild Truffle Forest Mushroom Pizza',
    category: 'Pizza',
    price: 450,
    item_type: 'Veg',
    stock_quantity: 30,
    description: 'Earthy cremini and oyster mushrooms, thyme, white truffle drizzle, and garlic cream cheese base.',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sundried Tomato & Walnut Pesto Pizza',
    category: 'Pizza',
    price: 410,
    item_type: 'Veg',
    stock_quantity: 35,
    description: 'Handcrafted Genovese basil pesto base with sweet sundried tomatoes, goat cheese, and toasted walnuts.',
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Spicy Lamb Sausage Rustica Pizza',
    category: 'Pizza',
    price: 480,
    item_type: 'Non Veg',
    stock_quantity: 30,
    description: 'Rustic Italian spiced lamb sausage, crushed chili oil, caramelized onions, and mozzarella.',
    image_url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80'
  },

  // 8. PASTA (10 items)
  {
    name: 'Penne all Arrabbiata Piccante',
    category: 'Pasta',
    price: 290,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Al dente penne pasta tossed in a fiery San Marzano tomato sauce infused with garlic, crushed red chilies, and fresh basil.',
    image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810a9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Creamy Parmesan Fettuccine Alfredo',
    category: 'Pasta',
    price: 340,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Ribbon pasta coated in rich butter, heavy cream, garlic, and aged parmigiano reggiano cheese.',
    image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Genoese Basil Pesto Fusilli',
    category: 'Pasta',
    price: 350,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Spiral pasta tossed with fresh sweet basil pesto, pine nuts, extra virgin olive oil, and cherry tomatoes.',
    image_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Creamy Pink Sauce Penne Delight',
    category: 'Pasta',
    price: 330,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'The perfect harmony of tangy pomodoro tomato sauce and rich cream sauce with penne pasta and herbs.',
    image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Classic Garlic Aglio e Olio Spaghetti',
    category: 'Pasta',
    price: 310,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Traditional spaghetti tossed with golden garlic slivers, red pepper flakes, parsley, and EVOO.',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Tuscan Grilled Chicken Alfredo',
    category: 'Pasta',
    price: 390,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Fettuccine alfredo topped with succulent grilled chicken breast strips and cracked black pepper.',
    image_url: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Fiery Chicken Penne Arrabbiata',
    category: 'Pasta',
    price: 380,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Tender grilled chicken breast tossed with penne in a spicy chili-pomodoro sauce with fresh herbs and aged parmesan.',
    image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62810a9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Spinach & Ricotta Stuffed Ravioli',
    category: 'Pasta',
    price: 410,
    item_type: 'Veg',
    stock_quantity: 30,
    description: 'Artisanal pasta parcels stuffed with farm-fresh spinach and creamy Italian ricotta, tossed in a sage butter parmesan sauce.',
    image_url: 'https://images.unsplash.com/photo-1587740408470-349f2575a7c2?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Baked Three-Cheese Macaroni',
    category: 'Pasta',
    price: 320,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Elbow macaroni baked in a bubbling sauce of cheddar, mozzarella, and fontina with golden panko crust.',
    image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Butter Garlic Prawn Spaghetti',
    category: 'Pasta',
    price: 450,
    item_type: 'Non Veg',
    stock_quantity: 30,
    description: 'Plump sautéed prawns tossed in a white wine lemon butter sauce with garlic and fresh flat-leaf parsley.',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
  },

  // 9. WRAPS & ROLLS (10 items)
  {
    name: 'Tandoori Paneer Tikka Wrap',
    category: 'Wraps',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Clay oven roasted paneer cubes tossed in tandoori spices and rolled in a paratha with mint chutney.',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Fiery Peri Peri Chicken Wrap',
    category: 'Wraps',
    price: 260,
    item_type: 'Non Veg',
    stock_quantity: 45,
    description: 'Grilled chicken tenders tossed in peri peri seasoning, rolled with crunchy lettuce and chili mayonnaise.',
    image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Authentic Falafel Tahini Hummus Wrap',
    category: 'Wraps',
    price: 210,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Crisp golden chickpea falafels with velvety hummus, pickled cucumbers, and garlic tahini in flatbread.',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Chipotle Roasted Veggie Burrito',
    category: 'Wraps',
    price: 200,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Spiced fajita bell peppers, roasted sweet corn, black beans, and chipotle rice wrapped in a flour tortilla.',
    image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Smoky BBQ Pulled Chicken Wrap',
    category: 'Wraps',
    price: 270,
    item_type: 'Non Veg',
    stock_quantity: 40,
    description: 'Slow-braised pulled chicken drenched in hickory BBQ sauce with creamy coleslaw in a soft wrap.',
    image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Caesar Grilled Chicken Crisp Wrap',
    category: 'Wraps',
    price: 280,
    item_type: 'Non Veg',
    stock_quantity: 40,
    description: 'Romaine lettuce, shaved parmesan, garlic croutons, and grilled chicken tossed in house Caesar dressing.',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Cheesy Sweet Corn & Mushroom Quesadilla',
    category: 'Wraps',
    price: 250,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Toasted Mexican tortilla folded with seasoned sweet corn, sautéed mushrooms, and melted cheese.',
    image_url: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Calcutta Chicken Kathi Roll',
    category: 'Wraps',
    price: 260,
    item_type: 'Non Veg',
    stock_quantity: 45,
    description: 'Flaky paratha layered with egg, spiced chicken pieces, sliced raw onions, and tangy green chili chutney.',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Grilled Halloumi & Bell Pepper Wrap',
    category: 'Wraps',
    price: 270,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Seared halloumi cheese with charred bell peppers, baby arugula, and olive tapenade in a warm wrap.',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Smoked Turkey Club Roll',
    category: 'Wraps',
    price: 290,
    item_type: 'Non Veg',
    stock_quantity: 35,
    description: 'Sliced smoked turkey, crisp bacon strips, sliced tomatoes, iceberg lettuce, and honey mustard spread.',
    image_url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80'
  },

  // 10. DESSERTS (10 items)
  {
    name: 'New York Baked Cheesecake Slice',
    category: 'Dessert',
    price: 280,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Rich dense cream cheese filling baked over a buttery graham cracker crust with strawberry coulis.',
    image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Belgian Walnut Fudge Brownie',
    category: 'Dessert',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 50,
    description: 'Warm gooey dark chocolate fudge brownie studded with toasted walnuts and served with chocolate fudge.',
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Classic Venetian Tiramisu Cup',
    category: 'Dessert',
    price: 290,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Espresso-soaked Savoiardi ladyfinger biscuits layered with sweetened mascarpone and dusted with cocoa.',
    image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Warm Molten Chocolate Lava Cake',
    category: 'Dessert',
    price: 260,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Decadent individual chocolate sponge cake with a molten liquid chocolate core that oozes on the first cut.',
    image_url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Red Velvet Vanilla Cream Slice',
    category: 'Dessert',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Velvety crimson sponge cake layered with silky whipped Madagascar vanilla cream cheese frosting.',
    image_url: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Nutella Banana Hazelnut Waffle',
    category: 'Dessert',
    price: 290,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Warm Belgian waffle smothered in rich Nutella hazelnut spread, sliced fresh bananas, and toasted nuts.',
    image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Warm Cinnamon Apple Pie Slice',
    category: 'Dessert',
    price: 240,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Flaky butter pastry filled with spiced Granny Smith apples and brown sugar, dusted with cinnamon powder.',
    image_url: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'French Blueberry Glaze Tart',
    category: 'Dessert',
    price: 220,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Crisp sweet shortcrust pastry filled with vanilla bean pastry cream and crowned with fresh blueberries.',
    image_url: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Triple Chocolate Fudge Sundae',
    category: 'Dessert',
    price: 250,
    item_type: 'Veg',
    stock_quantity: 45,
    description: 'Scoops of dark chocolate, milk chocolate, and vanilla gelato layered with hot fudge, brownies, and cream.',
    image_url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sicilian Pistachio Ricotta Cannoli',
    category: 'Dessert',
    price: 260,
    item_type: 'Veg',
    stock_quantity: 40,
    description: 'Crispy fried Italian pastry shells filled with sweetened sheep ricotta, candied orange, and crushed pistachios.',
    image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80'
  }
];

const seed100Menu = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Clear existing menu table
    await Menu.destroy({ where: {} });
    console.log('Cleared existing menu items.');

    // Prepare items with total_received, available, and rich description
    const preparedItems = menu100Items.map((item) => ({
      name: item.name,
      category: item.category,
      price: item.price,
      item_type: item.item_type || 'Veg',
      stock_quantity: item.stock_quantity || 40,
      total_received: item.stock_quantity || 40,
      available: true,
      image_url: item.image_url || null,
      description: item.description || ''
    }));

    // Bulk create 100 items with images and descriptions
    await Menu.bulkCreate(preparedItems);
    console.log(`Successfully inserted ${preparedItems.length} menu items with descriptions and photos!`);

    // Verify
    const countWithImages = await Menu.count({
      where: {
        image_url: { [require('sequelize').Op.ne]: null }
      }
    });
    const countWithDescriptions = await Menu.count({
      where: {
        description: { [require('sequelize').Op.ne]: null }
      }
    });
    console.log(`Total menu items with high-res photos: ${countWithImages} / ${preparedItems.length}`);
    console.log(`Total menu items with culinary descriptions: ${countWithDescriptions} / ${preparedItems.length}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding 100 menu items:', error);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  }
};

seed100Menu();
