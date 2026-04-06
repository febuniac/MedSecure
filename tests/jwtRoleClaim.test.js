const jwt = require('jsonwebtoken');
const { generateToken, SESSION_EXPIRY } = require('../src/middleware/auth');

const JWT_SECRET = 'test-secret-key';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('JWT Token Role Claim (Issue #65)', () => {
  const mockUser = {
    id: 'user-123',
    email: 'doctor@hospital.com',
    role: 'provider'
  };

  describe('generateToken', () => {
    it('should include role claim in the token payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('provider');
    });

    it('should include id and email in the token payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.id).toBe('user-123');
      expect(decoded.email).toBe('doctor@hospital.com');
    });

    it('should preserve admin role in the token', () => {
      const adminUser = { id: 'admin-1', email: 'admin@hospital.com', role: 'admin' };
      const token = generateToken(adminUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('admin');
    });

    it('should preserve viewer role in the token', () => {
      const viewerUser = { id: 'viewer-1', email: 'viewer@hospital.com', role: 'viewer' };
      const token = generateToken(viewerUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('viewer');
    });

    it('should preserve nurse role in the token', () => {
      const nurseUser = { id: 'nurse-1', email: 'nurse@hospital.com', role: 'nurse' };
      const token = generateToken(nurseUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('nurse');
    });

    it('should use HIPAA-compliant session expiry', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      const expectedExpiry = Math.floor(Date.now() / 1000) + 15 * 60;
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpiry - 5);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
    });

    it('should produce a valid JWT string', () => {
      const token = generateToken(mockUser);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('auth middleware verifies role from token', () => {
    it('should set req.user.role when verifying a token with role claim', () => {
      const authMiddleware = require('../src/middleware/auth');

      const token = generateToken(mockUser);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.role).toBe('provider');
      expect(req.user.id).toBe('user-123');
      expect(req.user.email).toBe('doctor@hospital.com');
    });

    it('should allow requireAdmin to work with role from JWT', () => {
      const requireAdmin = require('../src/middleware/requireAdmin');

      const adminUser = { id: 'admin-1', email: 'admin@hospital.com', role: 'admin' };
      const token = generateToken(adminUser);
      const decoded = jwt.verify(token, JWT_SECRET);

      const req = { user: decoded, path: '/users', method: 'GET', ip: '10.0.0.1' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block non-admin role from admin endpoints', () => {
      const requireAdmin = require('../src/middleware/requireAdmin');

      const token = generateToken(mockUser); // provider role
      const decoded = jwt.verify(token, JWT_SECRET);

      const req = { user: decoded, path: '/users', method: 'GET', ip: '10.0.0.1' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
