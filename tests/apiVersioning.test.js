const fs = require('fs');
const path = require('path');

describe('API Versioning', () => {
  describe('v1 router file structure', () => {
    test('src/api/v1.js exists', () => {
      const v1Path = path.join(__dirname, '..', 'src', 'api', 'v1.js');
      expect(fs.existsSync(v1Path)).toBe(true);
    });

    test('v1.js creates an Express router', () => {
      const v1Source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'api', 'v1.js'), 'utf8'
      );
      expect(v1Source).toContain("require('express').Router()");
    });

    test('v1.js registers all expected API route modules', () => {
      const v1Source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'api', 'v1.js'), 'utf8'
      );
      const expectedRoutes = [
        '/patients',
        '/records',
        '/appointments',
        '/prescriptions',
        '/providers',
        '/consent',
        '/provider-assignments',
        '/breach-notifications',
        '/baa-agreements',
        '/backup-verification',
        '/fhir/r4',
        '/auth',
      ];
      for (const route of expectedRoutes) {
        expect(v1Source).toContain(`'${route}'`);
      }
    });

    test('v1.js applies authMiddleware to protected routes', () => {
      const v1Source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'api', 'v1.js'), 'utf8'
      );
      expect(v1Source).toContain("require('../middleware/auth')");

      const lines = v1Source.split('\n');
      const routeLines = lines.filter(l => l.includes('router.use('));
      const authRouteLines = routeLines.filter(l => l.includes('/auth'));
      const protectedRouteLines = routeLines.filter(l => !l.includes("'/auth'"));

      // All protected routes should include authMiddleware
      for (const line of protectedRouteLines) {
        expect(line).toContain('authMiddleware');
      }

      // Auth route should NOT include authMiddleware
      for (const line of authRouteLines) {
        expect(line).not.toContain('authMiddleware');
      }
    });
  });

  describe('index.js route mounting', () => {
    const indexSource = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'index.js'), 'utf8'
    );

    test('index.js imports the v1 router', () => {
      expect(indexSource).toContain("require('./api/v1')");
    });

    test('index.js mounts v1 router at /api/v1', () => {
      expect(indexSource).toContain("'/api/v1'");
      expect(indexSource).toMatch(/app\.use\(['"]\/api\/v1['"]\s*,\s*v1Router\)/);
    });

    test('index.js does not mount individual API routes directly', () => {
      // Should NOT have direct route mounts like app.use('/api/v1/patients', ...)
      const lines = indexSource.split('\n');
      const directMountLines = lines.filter(l =>
        l.match(/app\.use\(['"]\/api\/v1\/(patients|records|appointments|prescriptions|providers|consent|auth|breach|baa|backup|fhir)/)
      );
      expect(directMountLines).toHaveLength(0);
    });

    test('index.js preserves /health endpoint at root level', () => {
      expect(indexSource).toMatch(/app\.get\(['"]\/health['"]/);
    });

    test('index.js does not import authMiddleware directly (delegated to v1 router)', () => {
      // authMiddleware should be handled by the v1 router, not index.js
      expect(indexSource).not.toContain("require('./middleware/auth')");
    });
  });

  describe('all API route modules exist', () => {
    const apiDir = path.join(__dirname, '..', 'src', 'api');
    const expectedFiles = [
      'patients.js',
      'records.js',
      'appointments.js',
      'prescriptions.js',
      'providers.js',
      'consent.js',
      'providerAssignments.js',
      'breachNotification.js',
      'baaAgreements.js',
      'backupVerification.js',
      'fhir.js',
      'auth.js',
      'v1.js',
    ];

    test.each(expectedFiles)('src/api/%s exists', (file) => {
      expect(fs.existsSync(path.join(apiDir, file))).toBe(true);
    });
  });
});
