const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.cwd(), process.env.DATA_DIR)
  : (process.env.VERCEL ? path.join('/tmp', 'smart-cafe-data') : path.resolve(__dirname, '../data'));
const controlPath = path.join(dataDir, 'owner-control.json');
const authActivityPath = path.join(dataDir, 'auth-activity.json');

const defaultControlState = {
  backupSchedule: {
    enabled: true,
    frequency: 'daily',
    time: '02:00'
  },
  rolePermissions: {
    owner: ['all'],
    manager: ['dashboard', 'menu', 'reports', 'billing'],
    chef: ['kitchen', 'order_status'],
    waiter: ['orders', 'billing'],
    staff: ['support'],
    master_waiter: ['orders', 'billing', 'tables']
  }
};

const ensureDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const readJson = (filePath, fallback) => {
  try {
    ensureDir();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  return value;
};

const getOwnerControlState = () => readJson(controlPath, defaultControlState);

const updateOwnerControlState = (patch) => {
  const current = getOwnerControlState();
  const next = {
    ...current,
    ...patch,
    backupSchedule: {
      ...current.backupSchedule,
      ...(patch.backupSchedule || {})
    },
    rolePermissions: {
      ...current.rolePermissions,
      ...(patch.rolePermissions || {})
    }
  };

  return writeJson(controlPath, next);
};

const getAuthActivity = () => readJson(authActivityPath, []);

const appendAuthActivity = (entry) => {
  const activity = getAuthActivity();
  activity.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry
  });

  return writeJson(authActivityPath, activity.slice(0, 200));
};

module.exports = {
  getOwnerControlState,
  updateOwnerControlState,
  getAuthActivity,
  appendAuthActivity
};
