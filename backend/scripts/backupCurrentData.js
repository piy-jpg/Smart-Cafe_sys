const fs = require('fs');
const path = require('path');
const { sequelize, Menu } = require('../models');

const backendDir = path.resolve(__dirname, '..');
const dataDir = path.join(backendDir, 'data');
const databasePath = path.join(backendDir, 'smart_cafe.sqlite');
const backupRoot = path.join(backendDir, 'backups');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, timestamp);
ensureDir(backupDir);

if (fs.existsSync(databasePath)) {
  fs.copyFileSync(databasePath, path.join(backupDir, 'smart_cafe.sqlite'));
}

for (const fileName of ['auth-activity.json', 'owner-control.json']) {
  const sourcePath = path.join(dataDir, fileName);
  if (!fs.existsSync(sourcePath)) continue;
  fs.copyFileSync(sourcePath, path.join(backupDir, fileName));
}

// Backup menu data as JSON
const backupMenuData = async () => {
  try {
    const menuItems = await Menu.findAll();
    const menuData = menuItems.map(item => item.toJSON());
    fs.writeFileSync(path.join(backupDir, 'menu.json'), JSON.stringify(menuData, null, 2));
  } catch (error) {
    console.error('Failed to backup menu data:', error.message);
  }
};

backupMenuData().then(() => {
  console.log(`Backup created at ${backupDir}`);
});
