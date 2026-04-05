const { logger } = require('../utils/logger');

/**
 * Database configuration module.
 *
 * Reads connection details exclusively from environment variables.
 * Supports DATABASE_URL (single connection string) or individual
 * DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME variables.
 *
 * No credentials are hardcoded in source code.
 */

const defaultPoolConfig = {
  min: 2,
  max: 20,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
  propagateCreateError: false,
  afterCreate: (conn, done) => {
    logger.info({ type: 'DB_POOL', action: 'connection_created' });
    done(null, conn);
  }
};

function getConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  };
}

function getTestConnectionConfig() {
  if (process.env.TEST_DATABASE_URL) {
    return {
      connectionString: process.env.TEST_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
    };
  }

  return {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST,
    port: process.env.TEST_DB_PORT || process.env.DB_PORT
      ? parseInt(process.env.TEST_DB_PORT || process.env.DB_PORT, 10)
      : undefined,
    user: process.env.TEST_DB_USER || process.env.DB_USER,
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.TEST_DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  };
}

function buildConnectionConfig(overrides = {}) {
  if (process.env.DATABASE_URL && Object.keys(overrides).length === 0) {
    return getConnectionConfig();
  }

  return {
    host: overrides.host || process.env.DB_HOST,
    port: overrides.port || (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined),
    user: overrides.user || process.env.DB_USER,
    password: overrides.password || process.env.DB_PASSWORD,
    database: overrides.database || process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  };
}

function buildKnexConfig(connectionOverrides = {}, poolOverrides = {}) {
  return {
    client: 'pg',
    connection: buildConnectionConfig(connectionOverrides),
    pool: { ...defaultPoolConfig, ...poolOverrides }
  };
}

function buildTestDbConfig(poolOverrides = {}) {
  return {
    client: 'pg',
    connection: getTestConnectionConfig(),
    pool: { min: 1, max: 5, ...poolOverrides }
  };
}

module.exports = {
  defaultPoolConfig,
  getConnectionConfig,
  getTestConnectionConfig,
  buildConnectionConfig,
  buildKnexConfig,
  buildTestDbConfig
};
