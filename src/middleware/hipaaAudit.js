const { logger } = require('../utils/logger');

/**
 * Determine failure reason from status code.
 */
function getFailureReason(statusCode) {
  switch (statusCode) {
    case 401:
      return 'authentication_failed';
    case 403:
      return 'authorization_denied';
    default:
      return undefined;
  }
}

module.exports = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const baseEntry = {
      method: req.method,
      path: req.path,
      userId: req.user?.id || 'anonymous',
      statusCode: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn({
        type: 'HIPAA_AUDIT_FAILED_ACCESS',
        ...baseEntry,
        failureReason: getFailureReason(res.statusCode),
        accessOutcome: 'denied'
      });
    } else {
      logger.info({
        type: 'HIPAA_AUDIT',
        ...baseEntry,
        accessOutcome: 'success'
      });
    }
  });
  next();
};

module.exports.getFailureReason = getFailureReason;
