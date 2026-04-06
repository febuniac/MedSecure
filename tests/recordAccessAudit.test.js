const express = require('express');
const request = require('supertest');

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../src/services/recordService', () => ({
  getByPatient: jest.fn(),
  getById: jest.fn(),
  create: jest.fn()
}));

const { logger } = require('../src/utils/logger');
const RecordService = require('../src/services/recordService');
const recordsRouter = require('../src/api/records');

function createApp() {
  const app = express();
  app.use(express.json());
  // Simulate auth middleware attaching user
  app.use((req, _res, next) => {
    req.user = { id: 'user-42', role: 'provider' };
    next();
  });
  app.use('/records', recordsRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Record access audit logging', () => {
  describe('GET /records/patient/:patientId', () => {
    it('should log a record_access audit entry with patientId and userId', async () => {
      RecordService.getByPatient.mockResolvedValue({
        data: [{ id: 'rec-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
      });

      const app = createApp();
      await request(app).get('/records/patient/patient-100').expect(200);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          action: 'record_access',
          patientId: 'patient-100',
          userId: 'user-42'
        })
      );
    });

    it('should include a valid ISO timestamp in the audit entry', async () => {
      RecordService.getByPatient.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });

      const app = createApp();
      await request(app).get('/records/patient/patient-200').expect(200);

      const logCall = logger.info.mock.calls[0][0];
      expect(logCall.timestamp).toBeDefined();
      expect(new Date(logCall.timestamp).getTime()).not.toBeNaN();
    });

    it('should not log an audit entry when service throws an error', async () => {
      RecordService.getByPatient.mockRejectedValue(
        Object.assign(new Error('Not found'), { code: 'RECORD_NOT_FOUND' })
      );

      const app = createApp();
      await request(app).get('/records/patient/bad-id').expect(404);

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'record_access' })
      );
    });
  });

  describe('GET /records/:id', () => {
    it('should log a record_access audit entry with patientId, recordId, and userId', async () => {
      RecordService.getById.mockResolvedValue({
        id: 'rec-55',
        patient_id: 'patient-300'
      });

      const app = createApp();
      await request(app).get('/records/rec-55').expect(200);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          action: 'record_access',
          patientId: 'patient-300',
          recordId: 'rec-55',
          userId: 'user-42'
        })
      );
    });

    it('should not log an audit entry when record is not found', async () => {
      RecordService.getById.mockRejectedValue(
        Object.assign(new Error('Record not found'), { code: 'RECORD_NOT_FOUND' })
      );

      const app = createApp();
      await request(app).get('/records/nonexistent').expect(404);

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'record_access' })
      );
    });
  });

  describe('POST /records', () => {
    it('should log a record_create audit entry with patientId, recordId, and userId', async () => {
      RecordService.create.mockResolvedValue({
        id: 'rec-99',
        patient_id: 'patient-400'
      });

      const app = createApp();
      await request(app)
        .post('/records')
        .send({ patient_id: 'patient-400', type: 'lab_result', data: {} })
        .expect(201);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          action: 'record_create',
          patientId: 'patient-400',
          recordId: 'rec-99',
          userId: 'user-42'
        })
      );
    });

    it('should not log an audit entry when record creation fails', async () => {
      RecordService.create.mockRejectedValue(new Error('DB error'));

      const app = createApp();
      await request(app)
        .post('/records')
        .send({ patient_id: 'patient-500' })
        .expect(500);

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'record_create' })
      );
    });
  });

  describe('auditLog helper', () => {
    const { auditLog } = require('../src/api/records');

    it('should log with type HIPAA_AUDIT and the given action', () => {
      auditLog('record_access', { patientId: 'p-1', userId: 'u-1' });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HIPAA_AUDIT',
          action: 'record_access',
          patientId: 'p-1',
          userId: 'u-1'
        })
      );
    });

    it('should include recordId when provided', () => {
      auditLog('record_access', { patientId: 'p-2', recordId: 'r-2', userId: 'u-2' });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 'r-2'
        })
      );
    });
  });
});
