const { validateEnv, REQUIRED_ENV_VARS } = require('../src/utils/validateEnv');

describe('Environment Variable Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw an error when all required env vars are missing', () => {
    REQUIRED_ENV_VARS.forEach(v => delete process.env[v]);
    expect(() => validateEnv()).toThrow('Missing required environment variables');
    expect(() => validateEnv()).toThrow('DB_PASSWORD');
    expect(() => validateEnv()).toThrow('JWT_SECRET');
    expect(() => validateEnv()).toThrow('ENCRYPTION_KEY');
  });

  it('should throw an error when DB_PASSWORD is missing', () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.DB_PASSWORD;
    expect(() => validateEnv()).toThrow('DB_PASSWORD');
  });

  it('should throw an error when JWT_SECRET is missing', () => {
    process.env.DB_PASSWORD = 'test-password';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    delete process.env.JWT_SECRET;
    expect(() => validateEnv()).toThrow('JWT_SECRET');
  });

  it('should throw an error when ENCRYPTION_KEY is missing', () => {
    process.env.DB_PASSWORD = 'test-password';
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.ENCRYPTION_KEY;
    expect(() => validateEnv()).toThrow('ENCRYPTION_KEY');
  });

  it('should not throw when all required env vars are set', () => {
    process.env.DB_PASSWORD = 'test-password';
    process.env.JWT_SECRET = 'test-secret';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    expect(() => validateEnv()).not.toThrow();
  });

  it('should list all missing variables in the error message', () => {
    delete process.env.DB_PASSWORD;
    delete process.env.JWT_SECRET;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      validateEnv();
      fail('Expected validateEnv to throw');
    } catch (err) {
      expect(err.message).toContain('DB_PASSWORD');
      expect(err.message).toContain('JWT_SECRET');
      expect(err.message).not.toContain('ENCRYPTION_KEY');
    }
  });

  it('should export the list of required env vars', () => {
    expect(REQUIRED_ENV_VARS).toEqual(['DB_PASSWORD', 'JWT_SECRET', 'ENCRYPTION_KEY']);
  });
});
