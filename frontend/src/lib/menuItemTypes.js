export const MENU_ITEM_TYPES = ['Veg', 'Non Veg'];

export const normalizeMenuItemType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'non veg' || normalized === 'non-veg' || normalized === 'nonveg') {
    return 'Non Veg';
  }
  return 'Veg';
};
