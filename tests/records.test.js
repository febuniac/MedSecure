const RecordService = require('../src/services/recordService');

// Mock the db module
jest.mock('../src/models/db', () => {
  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn()
  };

  const db = jest.fn(() => mockQuery);
  db._mockQuery = mockQuery;
  return db;
});

const db = require('../src/models/db');

describe('RecordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chainable mocks
    const q = db._mockQuery;
    q.where.mockReturnThis();
    q.orderBy.mockReturnThis();
    q.limit.mockReturnThis();
    q.offset.mockReturnThis();
    q.count.mockReturnThis();
  });

  describe('getByPatient', () => {
    const patientId = 'patient-123';
    const user = { id: 'user-1', role: 'provider' };

    function setupMocks(records, total) {
      // The method uses Promise.all with two parallel queries,
      // then calls _attachImageReferences which queries image_attachments.
      db.mockImplementation((table) => {
        if (table === 'image_attachments') {
          return {
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([])
          };
        }
        const chain = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue(records),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ total })
        };
        return chain;
      });
    }

    it('should return paginated records with default page=1 and limit=20', async () => {
      const mockRecords = Array.from({ length: 20 }, (_, i) => ({
        id: `rec-${i}`,
        patient_id: patientId,
        date: new Date(2025, 0, 20 - i).toISOString()
      }));
      setupMocks(mockRecords, 150);

      const result = await RecordService.getByPatient(patientId, user);

      expect(result.data).toHaveLength(20);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 150,
        totalPages: 8
      });
    });

    it('should respect custom page and limit parameters', async () => {
      const mockRecords = [{ id: 'rec-1', patient_id: patientId }];
      setupMocks(mockRecords, 50);

      const result = await RecordService.getByPatient(patientId, user, { page: 3, limit: 10 });

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5
      });

      // Verify the query targeted the correct table and pagination values are correct
      expect(db).toHaveBeenCalledWith('medical_records');
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      setupMocks([], 0);

      const result = await RecordService.getByPatient(patientId, user, { page: 1, limit: 500 });

      expect(result.pagination.limit).toBe(100);
    });

    it('should default to page 1 for invalid page values', async () => {
      setupMocks([], 0);

      const result = await RecordService.getByPatient(patientId, user, { page: -5, limit: 10 });

      expect(result.pagination.page).toBe(1);
    });

    it('should default to limit 20 for invalid limit values', async () => {
      setupMocks([], 0);

      const result = await RecordService.getByPatient(patientId, user, { page: 1, limit: 'abc' });

      expect(result.pagination.limit).toBe(20);
    });

    it('should handle string page and limit from query params', async () => {
      setupMocks([], 10);

      const result = await RecordService.getByPatient(patientId, user, { page: '2', limit: '5' });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2
      });
    });

    it('should return empty data with correct pagination when no records found', async () => {
      setupMocks([], 0);

      const result = await RecordService.getByPatient(patientId, user);

      expect(result.data).toHaveLength(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      });
    });

    it('should calculate totalPages correctly for non-even division', async () => {
      setupMocks([], 21);

      const result = await RecordService.getByPatient(patientId, user, { page: 1, limit: 10 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should work with no pagination options (backwards compatible)', async () => {
      const mockRecords = [{ id: 'rec-1' }];
      setupMocks(mockRecords, 1);

      const result = await RecordService.getByPatient(patientId, user);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('getLabResults', () => {
    const patientId = 'patient-123';
    const user = { id: 'user-1', role: 'provider' };

    function setupLabMocks(results, total) {
      const chains = [];
      db.mockImplementation(() => {
        const chain = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue(results),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ total })
        };
        chains.push(chain);
        return chain;
      });
      return chains;
    }

    it('should return lab results sorted by result_date descending', async () => {
      const mockResults = [
        { id: 'lab-1', patient_id: patientId, result_date: '2025-01-20', test_name: 'CBC' },
        { id: 'lab-2', patient_id: patientId, result_date: '2025-01-15', test_name: 'BMP' },
        { id: 'lab-3', patient_id: patientId, result_date: '2025-01-10', test_name: 'Lipid Panel' }
      ];
      setupLabMocks(mockResults, 3);

      const result = await RecordService.getLabResults(patientId, user);

      expect(result.data).toHaveLength(3);
      expect(result.data[0].test_name).toBe('CBC');
      expect(result.data[2].test_name).toBe('Lipid Panel');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      });

      // Verify the query was made against lab_results table
      expect(db).toHaveBeenCalledWith('lab_results');
    });

    it('should support pagination for lab results', async () => {
      const mockResults = [{ id: 'lab-1', patient_id: patientId }];
      setupLabMocks(mockResults, 50);

      const result = await RecordService.getLabResults(patientId, user, { page: 3, limit: 10 });

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5
      });
    });

    it('should cap limit at MAX_LIMIT (100) for lab results', async () => {
      setupLabMocks([], 0);

      const result = await RecordService.getLabResults(patientId, user, { page: 1, limit: 500 });

      expect(result.pagination.limit).toBe(100);
    });

    it('should return empty data when no lab results found', async () => {
      setupLabMocks([], 0);

      const result = await RecordService.getLabResults(patientId, user);

      expect(result.data).toHaveLength(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      });
    });
  });
});
