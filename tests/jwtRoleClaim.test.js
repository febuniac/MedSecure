const jwt = require('jsonwebtoken');

// Mock db module to avoid knex dependency
jest.mock('../src/models/db', () => jest.fn());

const authMiddleware = require('../src/middleware/auth');
const { generateToken, VALID_ROLES } = require('../src/middleware/auth');

const JWT_SECRET = 'test-secret-key';

describe('JWT Role Claim - Security', () => {
  describe('generateToken', () => {
    it('should include role in the token payload', () => {
      const user = { id: 1, email: 'doctor@hospital.com', role: 'provider' };
      const token = generateToken(user, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('provider');
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('doctor@hospital.com');
    });

    it('should include admin role in the token payload', () => {
      const user = { id: 2, email: 'admin@hospital.com', role: 'admin' };
      const token = generateToken(user, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('admin');
    });

    it('should include viewer role in the token payload', () => {
      const user = { id: 3, email: 'viewer@hospital.com', role: 'viewer' };
      const token = generateToken(user, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('viewer');
    });

    it('should include nurse role in the token payload', () => {
      const user = { id: 4, email: 'nurse@hospital.com', role: 'nurse' };
      const token = generateToken(user, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('nurse');
    });

    it('should throw when user has no role', () => {
      const user = { id: 1, email: 'norole@hospital.com' };
      expect(() => generateToken(user, JWT_SECRET, { expiresIn: '15m' })).toThrow(
        'Cannot generate token without a user role'
      );
    });

    it('should throw when user role is empty string', () => {
      const user = { id: 1, email: 'norole@hospital.com', role: '' };
      expect(() => generateToken(user, JWT_SECRET, { expiresIn: '15m' })).toThrow(
        'Cannot generate token without a user role'
      );
    });

    it('should throw when user role is null', () => {
      const user = { id: 1, email: 'norole@hospital.com', role: null };
      expect(() => generateToken(user, JWT_SECRET, { expiresIn: '15m' })).toThrow(
        'Cannot generate token without a user role'
      );
    });
  });

  describe('VALID_ROLES', () => {
    it('should include admin, provider, nurse, and viewer', () => {
      expect(VALID_ROLES).toContain('admin');
      expect(VALID_ROLES).toContain('provider');
      expect(VALID_ROLES).toContain('nurse');
      expect(VALID_ROLES).toContain('viewer');
    });
  });

  describe('auth middleware role validation', () => {
    let req, res, next;

    beforeEach(() => {
      process.env.JWT_SECRET = JWT_SECRET;
      next = jest.fn();
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should accept a token with a valid role and set req.user', () => {
      const token = jwt.sign({ id: 1, email: 'doc@hospital.com', role: 'provider' }, JWT_SECRET, { expiresIn: '15m' });
      req = { headers: { authorization: `Bearer ${token}` } };

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.role).toBe('provider');
      expect(req.user.id).toBe(1);
      expect(req.user.email).toBe('doc@hospital.com');
    });

    it('should reject a token without a role claim', () => {
      const token = jwt.sign({ id: 1, email: 'doc@hospital.com' }, JWT_SECRET, { expiresIn: '15m' });
      req = { headers: { authorization: `Bearer ${token}` } };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
            message: 'Token missing required role claim',
          }),
        })
      );
    });

    it('should reject a token with an invalid role', () => {
      const token = jwt.sign({ id: 1, email: 'doc@hospital.com', role: 'superuser' }, JWT_SECRET, { expiresIn: '15m' });
      req = { headers: { authorization: `Bearer ${token}` } };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject requests without a token', () => {
      req = { headers: {} };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTHENTICATION_REQUIRED',
          }),
        })
      );
    });

    it('should reject an expired token', () => {
      const token = jwt.sign({ id: 1, email: 'doc@hospital.com', role: 'provider' }, JWT_SECRET, { expiresIn: '-1s' });
      req = { headers: { authorization: `Bearer ${token}` } };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
    });

    it('should reject a token with an invalid signature', () => {
      const token = jwt.sign({ id: 1, email: 'doc@hospital.com', role: 'provider' }, 'wrong-secret', { expiresIn: '15m' });
      req = { headers: { authorization: `Bearer ${token}` } };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should accept all valid roles', () => {
      for (const role of VALID_ROLES) {
        const token = jwt.sign({ id: 1, email: 'user@hospital.com', role }, JWT_SECRET, { expiresIn: '15m' });
        req = { headers: { authorization: `Bearer ${token}` } };
        next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe(role);
      }
    });
  });
});
