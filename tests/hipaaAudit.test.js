const hipaaAuditMiddleware = require('../src/middleware/hipaaAudit');
const { getFailureReason } = require('../src/middleware/hipaaAudit');

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { logger } = require('../src/utils/logger');

beforeEach(() => {
  jest.clearAllMocks();
});

function createMockReqRes(overrides = {}) {
  const finishHandlers = [];
  const req = {
    user: { id: 'user-123' },
    ip: '10.0.0.1',
    path: '/api/v1/patients',
    method: 'GET',
    headers: { 'user-agent': 'test-agent' },
    ...overrides
  };
  const res = {
    statusCode: 200,
    on: jest.fn((event, handler) => {
      if (event === 'finish') finishHandlers.push(handler);
    }),
    ...overrides.res
  };
  return { req, res, finishHandlers };
}

describe('HIPAA Audit Middleware', () => {
  describe('getFailureReason', () => {
    test('returns authentication_failed for 401', () => {
      expect(getFailureReason(401)).toBe('authentication_failed');
    });

    test('returns authorization_denied for 403', () => {
      expect(getFailureReason(403)).toBe('authorization_denied');
    });

    test('returns undefined for other status codes', () => {
      expect(getFailureReason(200)).toBeUndefined();
      expect(getFailureReason(500)).toBeUndefined();
      expect(getFailureReason(404)).toBeUndefined();
    });
  });

  describe('successful access logging', () => {
    test('logs successful requests with logger.info and HIPAA_AUDIT type', () => {
      const { req, res, finishHandlers } = createMockReqRes();
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      finishHandlers.forEach(fn => fn());

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          method: 'GET',
          path: '/api/v1/patients',
          userId: 'user-123',
          statusCode: 200,
          ip: '10.0.0.1',
          userAgent: 'test-agent',
          accessOutcome: 'success'
        })
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('logs POST requests as successful', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        method: 'POST',
        path: '/api/v1/records',
        res: { statusCode: 201 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          method: 'POST',
          statusCode: 201,
          accessOutcome: 'success'
        })
      );
    });
  });

  describe('failed access logging (401/403)', () => {
    test('logs 401 responses with logger.warn and HIPAA_AUDIT_FAILED_ACCESS type', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        user: undefined,
        res: { statusCode: 401 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT_FAILED_ACCESS',
          method: 'GET',
          path: '/api/v1/patients',
          userId: 'anonymous',
          statusCode: 401,
          failureReason: 'authentication_failed',
          accessOutcome: 'denied'
        })
      );
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('logs 403 responses with logger.warn and HIPAA_AUDIT_FAILED_ACCESS type', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        res: { statusCode: 403 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT_FAILED_ACCESS',
          method: 'GET',
          path: '/api/v1/patients',
          userId: 'user-123',
          statusCode: 403,
          failureReason: 'authorization_denied',
          accessOutcome: 'denied'
        })
      );
      expect(logger.info).not.toHaveBeenCalled();
    });

    test('logs anonymous userId when user is not set on 401', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        user: undefined,
        res: { statusCode: 401 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous'
        })
      );
    });

    test('captures IP address and user-agent for failed access attempts', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        ip: '192.168.1.100',
        headers: { 'user-agent': 'suspicious-bot/1.0' },
        res: { statusCode: 401 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '192.168.1.100',
          userAgent: 'suspicious-bot/1.0'
        })
      );
    });

    test('includes timestamp in failed access log entries', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        res: { statusCode: 401 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      const logCall = logger.warn.mock.calls[0][0];
      expect(logCall.timestamp).toBeDefined();
      expect(new Date(logCall.timestamp).getTime()).not.toBeNaN();
    });

    test('includes timestamp in successful access log entries', () => {
      const { req, res, finishHandlers } = createMockReqRes();
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      const logCall = logger.info.mock.calls[0][0];
      expect(logCall.timestamp).toBeDefined();
      expect(new Date(logCall.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('middleware behavior', () => {
    test('calls next() to pass through', () => {
      const { req, res } = createMockReqRes();
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('registers a finish event handler', () => {
      const { req, res } = createMockReqRes();
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    test('does not log 404 as failed access', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        res: { statusCode: 404 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          accessOutcome: 'success'
        })
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('does not log 500 as failed access', () => {
      const { req, res, finishHandlers } = createMockReqRes({
        res: { statusCode: 500 }
      });
      const next = jest.fn();

      hipaaAuditMiddleware(req, res, next);
      finishHandlers.forEach(fn => fn());

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          accessOutcome: 'success'
        })
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
