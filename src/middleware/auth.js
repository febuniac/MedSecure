const jwt = require('jsonwebtoken');
const { ErrorCodes, formatError } = require('../utils/errorCodes');

const VALID_ROLES = ['admin', 'provider', 'nurse', 'viewer'];

/**
 * Generate a signed JWT that always includes the user's role.
 *
 * @param {{ id: number|string, email: string, role: string }} user
 * @param {string} secret
 * @param {{ expiresIn: string }} options
 * @returns {string} signed JWT
 */
function generateToken(user, secret, options = {}) {
  if (!user.role) {
    throw new Error('Cannot generate token without a user role');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    options
  );
}

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json(formatError(ErrorCodes.AUTHENTICATION_REQUIRED, 'Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.role || !VALID_ROLES.includes(decoded.role)) {
      return res.status(401).json(formatError(ErrorCodes.INVALID_TOKEN, 'Token missing required role claim'));
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json(formatError(ErrorCodes.INVALID_TOKEN, 'Invalid token'));
  }
};

module.exports = authMiddleware;
module.exports.generateToken = generateToken;
module.exports.VALID_ROLES = VALID_ROLES;
