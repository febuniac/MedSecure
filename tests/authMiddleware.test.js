const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-jwt-secret-key';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

const auth = require('../src/middleware/auth');
const { generateToken } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('should include role claim in the JWT payload', () => {
      const user = { id: 1, email: 'doctor@medsecure.com', role: 'physician' };
      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_SECRET);

      expect(decoded.role).toBe('physician');
    });

    it('should include id and email claims in the JWT payload', () => {
      const user = { id: 42, email: 'admin@medsecure.com', role: 'admin' };
      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_SECRET);

      expect(decoded.id).toBe(42);
      expect(decoded.email).toBe('admin@medsecure.com');
    });

    it('should set expiration to 8 hours', () => {
      const user = { id: 1, email: 'nurse@medsecure.com', role: 'nurse' };
      const token = generateToken(user);
      const decoded = jwt.verify(token, TEST_SECRET);

      const expectedExp = decoded.iat + 8 * 60 * 60;
      expect(decoded.exp).toBe(expectedExp);
    });

    it('should produce a valid JWT string', () => {
      const user = { id: 1, email: 'user@medsecure.com', role: 'viewer' };
      const token = generateToken(user);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should preserve different role values', () => {
      const roles = ['admin', 'physician', 'nurse', 'viewer'];
      roles.forEach((role) => {
        const user = { id: 1, email: 'user@medsecure.com', role };
        const token = generateToken(user);
        const decoded = jwt.verify(token, TEST_SECRET);
        expect(decoded.role).toBe(role);
      });
    });
  });

  describe('authenticate middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('should return 401 if no token is provided', () => {
      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for an invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should set req.user with role from a valid token and call next', () => {
      const user = { id: 5, email: 'doctor@medsecure.com', role: 'physician' };
      const token = generateToken(user);
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe(5);
      expect(req.user.email).toBe('doctor@medsecure.com');
      expect(req.user.role).toBe('physician');
    });

    it('should preserve admin role through token round-trip', () => {
      const user = { id: 10, email: 'admin@medsecure.com', role: 'admin' };
      const token = generateToken(user);
      req.headers.authorization = `Bearer ${token}`;

      auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.role).toBe('admin');
    });
  });
});
