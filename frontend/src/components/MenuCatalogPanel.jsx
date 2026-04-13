import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardMedia, Chip, TextField, Typography } from '@mui/material';
import { getMenuImage } from '../lib/menuArt';
import { normalizeMenuItemType } from '../lib/menuItemTypes';

const MenuCatalogPanel = ({
  menu = [],
  title = 'Menu Catalog',
  subtitle = 'Live menu availability and pricing.',
  maxItems
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const categories = useMemo(
    () => ['All', ...new Set(menu.map((item) => item.category).filter(Boolean))],
    [menu]
  );

  const visibleItems = useMemo(() => {
    const filtered = menu
      .filter((item) => category === 'All' || item.category === category)
      .filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((left, right) => left.name.localeCompare(right.name));

    return typeof maxItems === 'number' ? filtered.slice(0, maxItems) : filtered;
  }, [category, maxItems, menu, search]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Typography variant="h5" className="font-bold text-slate-900">{title}</Typography>
          <Typography className="mt-1 text-sm text-slate-500">{subtitle}</Typography>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TextField
            size="small"
            label="Search menu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Coffee, wrap, pasta..."
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          >
            {categories.map((itemCategory) => (
              <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <Card key={item.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <CardMedia
              component="img"
              height="148"
              image={getMenuImage(item)}
              alt={item.name}
              className="h-36 object-cover"
            />
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Typography className="font-bold text-slate-900">{item.name}</Typography>
                  <Typography className="mt-1 text-sm text-slate-500">{item.category}</Typography>
                </div>
                <Typography className="font-black text-emerald-600">${Number(item.price || 0).toFixed(2)}</Typography>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip size="small" label={`Stock ${Number(item.stock_quantity || 0)}`} />
                <Chip size="small" color={normalizeMenuItemType(item.item_type) === 'Non Veg' ? 'error' : 'success'} label={normalizeMenuItemType(item.item_type)} />
                <Chip
                  size="small"
                  color={item.available !== false && Number(item.stock_quantity || 0) > 0 ? 'success' : 'default'}
                  label={item.available !== false && Number(item.stock_quantity || 0) > 0 ? 'Available' : 'Unavailable'}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!visibleItems.length && (
        <Typography className="mt-6 text-sm italic text-slate-500">
          No menu items match this filter.
        </Typography>
      )}
    </div>
  );
};

export default MenuCatalogPanel;
