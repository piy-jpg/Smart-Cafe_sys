const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const explicitDialect = String(process.env.DB_DIALECT || '').trim().toLowerCase();
const configuredDbName = String(process.env.DB_NAME || '').trim();
const configuredDbUser = String(process.env.DB_USER || '').trim();
const configuredDbPassword = String(process.env.DB_PASSWORD || '');
const configuredDbHost = String(process.env.DB_HOST || '').trim();
const configuredDbPort = Number.parseInt(process.env.DB_PORT || '', 10);
const hasDiscreteDbConfig = Boolean(configuredDbName && configuredDbUser && configuredDbHost);
const dialect = explicitDialect || (databaseUrl || hasDiscreteDbConfig ? 'mysql' : 'sqlite');

const sqliteStoragePath = process.env.SQLITE_STORAGE_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_STORAGE_PATH)
  : path.resolve(__dirname, '../smart_cafe.sqlite');

const mysqlDialectOptions = process.env.DB_SSL === 'true'
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  : undefined;

const sequelize = dialect === 'sqlite'
  ? new Sequelize({
      dialect: 'sqlite',
      storage: sqliteStoragePath,
      logging: false
    })
  : (databaseUrl
    ? new Sequelize(databaseUrl, {
        dialect,
        logging: false,
        dialectOptions: mysqlDialectOptions
      })
    : new Sequelize(
        configuredDbName,
        configuredDbUser,
        configuredDbPassword,
        {
          host: configuredDbHost || '127.0.0.1',
          port: Number.isFinite(configuredDbPort) ? configuredDbPort : 3306,
          dialect,
          logging: false,
          dialectOptions: mysqlDialectOptions
        }
      ));

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`${dialect} database connected successfully.`);
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
  }
};

module.exports = { sequelize, connectDB, dialect, sqliteStoragePath };
