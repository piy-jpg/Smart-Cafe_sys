export const DEFAULT_MENU_CATEGORIES = [
  'Hot Coffee',
  'Iced Coffee',
  'Tea',
  'Bakery',
  'Breakfast',
  'Lunch',
  'Dessert',
  'Smoothies',
  'Refreshers',
  'Milkshakes',
  'Wraps',
  'Burgers',
  'Pasta',
  'Pizza',
  'Salads',
  'Mocktails',
  'Waffles',
  'Sundaes'
];

export const getMenuCategoryOptions = (menu = []) => (
  [...new Set([
    ...DEFAULT_MENU_CATEGORIES,
    ...menu.map((item) => String(item?.category || '').trim()).filter(Boolean)
  ])]
);
