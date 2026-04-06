const helmet = require('helmet');
const { logger } = require('../utils/logger');

const HSTS_MAX_AGE = 31536000; // 1 year in seconds

/**
 * Configures helmet with explicit, HIPAA-appropriate security headers.
 *
 * Headers set:
 *  - Strict-Transport-Security (HSTS) with includeSubDomains and preload
 *  - X-Content-Type-Options: nosniff
 *  - X-Frame-Options: DENY
 *  - Content-Security-Policy: default-src 'self'
 *  - Referrer-Policy: strict-origin-when-cross-origin
 *  - X-Permitted-Cross-Domain-Policies: none
 *  - Removes X-Powered-By
 */
function createSecurityHeadersMiddleware() {
  const helmetMiddleware = helmet({
    // Enforce HTTPS via HSTS — critical for PHI in transit
    hsts: {
      maxAge: HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true
    },
    // Prevent MIME-type sniffing
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Control referrer information
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Restrict cross-domain policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Remove X-Powered-By
    hidePoweredBy: true
  });

  return function securityHeaders(req, res, next) {
    helmetMiddleware(req, res, (err) => {
      if (err) {
        logger.error({ type: 'SECURITY_HEADERS', error: err.message });
        return next(err);
      }

      logger.info({
        type: 'SECURITY_HEADERS',
        action: 'applied',
        path: req.path
      });

      next();
    });
  };
}

module.exports = createSecurityHeadersMiddleware;
module.exports.HSTS_MAX_AGE = HSTS_MAX_AGE;
