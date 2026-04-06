const createSecurityHeadersMiddleware = require('../src/middleware/securityHeaders');
const { HSTS_MAX_AGE } = require('../src/middleware/securityHeaders');

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { logger } = require('../src/utils/logger');

beforeEach(() => {
  jest.clearAllMocks();
});

function createMockReq(overrides = {}) {
  return {
    path: '/api/v1/patients',
    method: 'GET',
    headers: {},
    ...overrides
  };
}

function createMockRes() {
  const headers = {};
  const res = {
    setHeader: jest.fn((name, value) => {
      headers[name.toLowerCase()] = value;
    }),
    removeHeader: jest.fn((name) => {
      delete headers[name.toLowerCase()];
    }),
    getHeader: jest.fn((name) => headers[name.toLowerCase()]),
    _headers: headers
  };
  return res;
}

describe('Security Headers Middleware', () => {
  let middleware;

  beforeEach(() => {
    middleware = createSecurityHeadersMiddleware();
  });

  describe('exports', () => {
    test('createSecurityHeadersMiddleware is a function', () => {
      expect(typeof createSecurityHeadersMiddleware).toBe('function');
    });

    test('returns a middleware function', () => {
      expect(typeof middleware).toBe('function');
    });

    test('exports HSTS_MAX_AGE constant', () => {
      expect(typeof HSTS_MAX_AGE).toBe('number');
      expect(HSTS_MAX_AGE).toBe(31536000);
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    test('sets Strict-Transport-Security header', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const hstsCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'strict-transport-security'
        );
        expect(hstsCalls.length).toBeGreaterThan(0);
        done();
      });
    });

    test('HSTS max-age is at least 1 year (31536000 seconds)', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const hstsCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'strict-transport-security'
        );
        expect(hstsCalls.length).toBeGreaterThan(0);
        const hstsValue = hstsCalls[0][1];
        const maxAgeMatch = hstsValue.match(/max-age=(\d+)/);
        expect(maxAgeMatch).not.toBeNull();
        expect(parseInt(maxAgeMatch[1], 10)).toBeGreaterThanOrEqual(31536000);
        done();
      });
    });

    test('HSTS includes includeSubDomains', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const hstsCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'strict-transport-security'
        );
        const hstsValue = hstsCalls[0][1];
        expect(hstsValue).toContain('includeSubDomains');
        done();
      });
    });

    test('HSTS includes preload', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const hstsCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'strict-transport-security'
        );
        const hstsValue = hstsCalls[0][1];
        expect(hstsValue).toContain('preload');
        done();
      });
    });
  });

  describe('X-Content-Type-Options', () => {
    test('sets X-Content-Type-Options to nosniff', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const nosniffCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'x-content-type-options'
        );
        expect(nosniffCalls.length).toBeGreaterThan(0);
        expect(nosniffCalls[0][1]).toBe('nosniff');
        done();
      });
    });
  });

  describe('X-Frame-Options', () => {
    test('sets X-Frame-Options to DENY', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const frameCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'x-frame-options'
        );
        expect(frameCalls.length).toBeGreaterThan(0);
        expect(frameCalls[0][1]).toBe('DENY');
        done();
      });
    });
  });

  describe('Content-Security-Policy', () => {
    test('sets Content-Security-Policy header', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const cspCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'content-security-policy'
        );
        expect(cspCalls.length).toBeGreaterThan(0);
        done();
      });
    });

    test('CSP includes default-src self', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const cspCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'content-security-policy'
        );
        const cspValue = cspCalls[0][1];
        expect(cspValue).toContain("default-src 'self'");
        done();
      });
    });

    test('CSP blocks object embedding', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const cspCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'content-security-policy'
        );
        const cspValue = cspCalls[0][1];
        expect(cspValue).toContain("object-src 'none'");
        done();
      });
    });

    test('CSP blocks framing via frame-ancestors', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const cspCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'content-security-policy'
        );
        const cspValue = cspCalls[0][1];
        expect(cspValue).toContain("frame-ancestors 'none'");
        done();
      });
    });
  });

  describe('Referrer-Policy', () => {
    test('sets Referrer-Policy header', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const refCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'referrer-policy'
        );
        expect(refCalls.length).toBeGreaterThan(0);
        expect(refCalls[0][1]).toBe('strict-origin-when-cross-origin');
        done();
      });
    });
  });

  describe('X-Permitted-Cross-Domain-Policies', () => {
    test('sets X-Permitted-Cross-Domain-Policies to none', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const cdpCalls = res.setHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'x-permitted-cross-domain-policies'
        );
        expect(cdpCalls.length).toBeGreaterThan(0);
        expect(cdpCalls[0][1]).toBe('none');
        done();
      });
    });
  });

  describe('X-Powered-By removal', () => {
    test('removes X-Powered-By header', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        const poweredByCalls = res.removeHeader.mock.calls.filter(
          c => c[0].toLowerCase() === 'x-powered-by'
        );
        expect(poweredByCalls.length).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('logging', () => {
    test('logs security headers application', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SECURITY_HEADERS',
            action: 'applied',
            path: '/api/v1/patients'
          })
        );
        done();
      });
    });

    test('logs with correct path for different routes', (done) => {
      const req = createMockReq({ path: '/health' });
      const res = createMockRes();

      middleware(req, res, () => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SECURITY_HEADERS',
            action: 'applied',
            path: '/health'
          })
        );
        done();
      });
    });
  });

  describe('middleware integration', () => {
    test('calls next() after applying headers', (done) => {
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {
        // If we reach here, next() was called
        done();
      });
    });

    test('applies headers to all routes', (done) => {
      const routes = ['/api/v1/patients', '/api/v1/records', '/health', '/api/v1/providers'];
      let completed = 0;

      routes.forEach((path) => {
        const req = createMockReq({ path });
        const res = createMockRes();

        middleware(req, res, () => {
          const hstsCalls = res.setHeader.mock.calls.filter(
            c => c[0].toLowerCase() === 'strict-transport-security'
          );
          expect(hstsCalls.length).toBeGreaterThan(0);

          const nosniffCalls = res.setHeader.mock.calls.filter(
            c => c[0].toLowerCase() === 'x-content-type-options'
          );
          expect(nosniffCalls.length).toBeGreaterThan(0);

          completed++;
          if (completed === routes.length) done();
        });
      });
    });
  });

  describe('HIPAA compliance', () => {
    test('all critical security headers are present for PHI endpoints', (done) => {
      const req = createMockReq({ path: '/api/v1/patients' });
      const res = createMockRes();

      middleware(req, res, () => {
        const headerNames = res.setHeader.mock.calls.map(c => c[0].toLowerCase());

        expect(headerNames).toContain('strict-transport-security');
        expect(headerNames).toContain('x-content-type-options');
        expect(headerNames).toContain('x-frame-options');
        expect(headerNames).toContain('content-security-policy');
        expect(headerNames).toContain('referrer-policy');
        done();
      });
    });

    test('all critical security headers are present for records endpoints', (done) => {
      const req = createMockReq({ path: '/api/v1/records' });
      const res = createMockRes();

      middleware(req, res, () => {
        const headerNames = res.setHeader.mock.calls.map(c => c[0].toLowerCase());

        expect(headerNames).toContain('strict-transport-security');
        expect(headerNames).toContain('x-content-type-options');
        expect(headerNames).toContain('x-frame-options');
        expect(headerNames).toContain('content-security-policy');
        expect(headerNames).toContain('referrer-policy');
        done();
      });
    });
  });
});
