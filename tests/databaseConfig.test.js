const { getConnectionConfig, getTestConnectionConfig } = require('../src/config/database');

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.TEST_DATABASE_URL;
    delete process.env.TEST_DB_HOST;
    delete process.env.TEST_DB_PORT;
    delete process.env.TEST_DB_USER;
    delete process.env.TEST_DB_PASSWORD;
    delete process.env.TEST_DB_NAME;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getConnectionConfig', () => {
    it('should use DATABASE_URL when set', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/mydb';
      const config = getConnectionConfig();
      expect(config.connectionString).toBe('postgresql://user:pass@host:5432/mydb');
      expect(config.host).toBeUndefined();
    });

    it('should use individual DB_* env vars when DATABASE_URL is not set', () => {
      process.env.DB_HOST = 'db.example.com';
      process.env.DB_PORT = '5433';
      process.env.DB_USER = 'appuser';
      process.env.DB_PASSWORD = 's3cret';
      process.env.DB_NAME = 'appdb';
      const config = getConnectionConfig();
      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(5433);
      expect(config.user).toBe('appuser');
      expect(config.password).toBe('s3cret');
      expect(config.database).toBe('appdb');
      expect(config.connectionString).toBeUndefined();
    });

    it('should return undefined for missing individual env vars instead of hardcoded defaults', () => {
      const config = getConnectionConfig();
      expect(config.host).toBeUndefined();
      expect(config.port).toBeUndefined();
      expect(config.user).toBeUndefined();
      expect(config.password).toBeUndefined();
      expect(config.database).toBeUndefined();
    });

    it('should not contain hardcoded credentials like localhost, medsecure, or medsecure_db', () => {
      const config = getConnectionConfig();
      const configStr = JSON.stringify(config);
      expect(configStr).not.toContain('localhost');
      expect(configStr).not.toContain('medsecure');
      expect(configStr).not.toContain('medsecure_db');
    });

    it('should enable SSL with rejectUnauthorized in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/mydb';
      const config = getConnectionConfig();
      expect(config.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('should disable SSL in non-production', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/mydb';
      const config = getConnectionConfig();
      expect(config.ssl).toBe(false);
    });
  });

  describe('getTestConnectionConfig', () => {
    it('should use TEST_DATABASE_URL when set', () => {
      process.env.TEST_DATABASE_URL = 'postgresql://testuser:testpass@testhost:5432/testdb';
      const config = getTestConnectionConfig();
      expect(config.connectionString).toBe('postgresql://testuser:testpass@testhost:5432/testdb');
      expect(config.host).toBeUndefined();
    });

    it('should fall back to DB_* vars when TEST_DB_* vars are not set', () => {
      process.env.DB_HOST = 'db.example.com';
      process.env.DB_PORT = '5433';
      process.env.DB_USER = 'appuser';
      process.env.DB_PASSWORD = 's3cret';
      const config = getTestConnectionConfig();
      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(5433);
      expect(config.user).toBe('appuser');
      expect(config.password).toBe('s3cret');
    });

    it('should prefer TEST_DB_* vars over DB_* vars', () => {
      process.env.DB_HOST = 'db.example.com';
      process.env.TEST_DB_HOST = 'testdb.example.com';
      process.env.DB_USER = 'appuser';
      process.env.TEST_DB_USER = 'testuser';
      const config = getTestConnectionConfig();
      expect(config.host).toBe('testdb.example.com');
      expect(config.user).toBe('testuser');
    });

    it('should not contain hardcoded credentials like localhost or medsecure', () => {
      const config = getTestConnectionConfig();
      const configStr = JSON.stringify(config);
      expect(configStr).not.toContain('localhost');
      expect(configStr).not.toContain('medsecure');
    });

    it('should enable SSL with rejectUnauthorized in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_DATABASE_URL = 'postgresql://user:pass@host/testdb';
      const config = getTestConnectionConfig();
      expect(config.ssl).toEqual({ rejectUnauthorized: true });
    });
  });
});
