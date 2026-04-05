const ProviderPatientService = require('../src/services/providerPatientService');
const PatientService = require('../src/services/patientService');
const RecordService = require('../src/services/recordService');

// Mock the database module
jest.mock('../src/models/db', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.where = jest.fn(() => mockKnex);
  mockKnex.whereIn = jest.fn(() => mockKnex);
  mockKnex.first = jest.fn(() => mockKnex);
  mockKnex.select = jest.fn(() => mockKnex);
  mockKnex.insert = jest.fn(() => mockKnex);
  mockKnex.update = jest.fn(() => mockKnex);
  mockKnex.returning = jest.fn(() => mockKnex);
  mockKnex.orderBy = jest.fn(() => mockKnex);
  mockKnex.index = jest.fn(() => mockKnex);
  return mockKnex;
});

jest.mock('../src/utils/encryption', () => ({
  encrypt: jest.fn(text => `encrypted_${text}`),
  decrypt: jest.fn(text => text.replace('encrypted_', ''))
}));

const db = require('../src/models/db');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the mock chain
  db.mockImplementation(() => db);
  db.where.mockReturnValue(db);
  db.whereIn.mockReturnValue(db);
  db.first.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.insert.mockReturnValue(db);
  db.update.mockReturnValue(db);
  db.returning.mockReturnValue(db);
  db.orderBy.mockReturnValue(db);
});

// Test users
const assignedProvider = {
  id: 'provider-1',
  provider_id: 'provider-group-1',
  role: 'provider'
};

const unassignedProvider = {
  id: 'provider-2',
  provider_id: 'provider-group-2',
  role: 'provider'
};

const adminUser = {
  id: 'admin-1',
  provider_id: 'admin-group',
  role: 'admin'
};

describe('ProviderPatientService', () => {
  describe('isAssigned', () => {
    it('should return true when provider is assigned to patient', async () => {
      db.first.mockResolvedValue({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });

      const result = await ProviderPatientService.isAssigned('provider-group-1', 'patient-1');
      expect(result).toBe(true);
      expect(db).toHaveBeenCalledWith('provider_patient_assignments');
      expect(db.where).toHaveBeenCalledWith({
        provider_id: 'provider-group-1',
        patient_id: 'patient-1',
        status: 'active'
      });
    });

    it('should return false when provider is not assigned to patient', async () => {
      db.first.mockResolvedValue(undefined);

      const result = await ProviderPatientService.isAssigned('provider-group-2', 'patient-1');
      expect(result).toBe(false);
    });
  });

  describe('verifyAccess', () => {
    it('should allow admin users to access any patient', async () => {
      const result = await ProviderPatientService.verifyAccess(adminUser, 'patient-1');
      expect(result).toBe(true);
      // Admin should not trigger a DB query
      expect(db).not.toHaveBeenCalled();
    });

    it('should allow assigned provider to access patient', async () => {
      db.first.mockResolvedValue({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });

      const result = await ProviderPatientService.verifyAccess(assignedProvider, 'patient-1');
      expect(result).toBe(true);
    });

    it('should deny unassigned provider access to patient with 403', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        ProviderPatientService.verifyAccess(unassignedProvider, 'patient-1')
      ).rejects.toMatchObject({
        message: 'Access denied: provider not assigned to this patient',
        status: 403
      });
    });
  });

  describe('assign', () => {
    it('should create a new assignment when none exists', async () => {
      db.first.mockResolvedValue(undefined);
      db.returning.mockResolvedValue([{
        id: 1,
        provider_id: 'provider-group-1',
        patient_id: 'patient-1',
        assigned_by: 'admin-1',
        status: 'active'
      }]);

      const result = await ProviderPatientService.assign('provider-group-1', 'patient-1', 'admin-1');
      expect(result).toEqual(expect.objectContaining({
        provider_id: 'provider-group-1',
        patient_id: 'patient-1',
        status: 'active'
      }));
    });

    it('should return existing assignment if already active', async () => {
      const existing = { id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' };
      db.first.mockResolvedValue(existing);

      const result = await ProviderPatientService.assign('provider-group-1', 'patient-1', 'admin-1');
      expect(result).toEqual(existing);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('unassign', () => {
    it('should set assignment status to inactive', async () => {
      db.returning.mockResolvedValue([{
        id: 1,
        provider_id: 'provider-group-1',
        patient_id: 'patient-1',
        status: 'inactive'
      }]);

      const result = await ProviderPatientService.unassign('provider-group-1', 'patient-1');
      expect(result).toEqual(expect.objectContaining({
        status: 'inactive'
      }));
      expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'inactive'
      }));
    });
  });

  describe('listByProvider', () => {
    it('should return active patient assignments for a provider', async () => {
      db.select.mockResolvedValue([{ patient_id: 'patient-1' }, { patient_id: 'patient-2' }]);

      const result = await ProviderPatientService.listByProvider('provider-group-1');
      expect(result).toHaveLength(2);
      expect(db.where).toHaveBeenCalledWith({
        provider_id: 'provider-group-1',
        status: 'active'
      });
    });
  });

  describe('listByPatient', () => {
    it('should return active provider assignments for a patient', async () => {
      db.select.mockResolvedValue([{ provider_id: 'provider-group-1' }]);

      const result = await ProviderPatientService.listByPatient('patient-1');
      expect(result).toHaveLength(1);
      expect(db.where).toHaveBeenCalledWith({
        patient_id: 'patient-1',
        status: 'active'
      });
    });
  });
});

describe('PatientService - Access Control', () => {
  describe('list', () => {
    it('should return only assigned patients for a provider', async () => {
      db.select.mockResolvedValueOnce([{ patient_id: 'patient-1' }]);
      db.select.mockResolvedValueOnce([{ id: 'patient-1', first_name: 'John', last_name: 'Doe' }]);

      await PatientService.list({}, assignedProvider);
      expect(db.whereIn).toHaveBeenCalledWith('id', ['patient-1']);
    });

    it('should return all patients for admin users', async () => {
      db.select.mockResolvedValue([
        { id: 'patient-1', first_name: 'John' },
        { id: 'patient-2', first_name: 'Jane' }
      ]);

      await PatientService.list({}, adminUser);
      // Admin should query patients directly without whereIn filter
      expect(db).toHaveBeenCalledWith('patients');
      expect(db.whereIn).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should allow assigned provider to get patient by ID', async () => {
      // Mock verifyAccess - provider is assigned
      db.first.mockResolvedValueOnce({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });
      // Mock patient query
      db.first.mockResolvedValueOnce({ id: 'patient-1', first_name: 'John', ssn_encrypted: 'encrypted_123-45-6789' });

      const result = await PatientService.getById('patient-1', assignedProvider);
      expect(result).toEqual(expect.objectContaining({ id: 'patient-1', first_name: 'John' }));
    });

    it('should deny unassigned provider from getting patient by ID', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        PatientService.getById('patient-1', unassignedProvider)
      ).rejects.toMatchObject({
        status: 403
      });
    });

    it('should allow admin to get any patient by ID', async () => {
      db.first.mockResolvedValue({ id: 'patient-1', first_name: 'John', ssn_encrypted: 'encrypted_123-45-6789' });

      const result = await PatientService.getById('patient-1', adminUser);
      expect(result).toEqual(expect.objectContaining({ id: 'patient-1' }));
    });
  });

  describe('create', () => {
    it('should auto-assign creating provider to the new patient', async () => {
      db.returning.mockResolvedValueOnce([{ id: 'patient-new', first_name: 'New' }]);
      // Mock for the auto-assignment check (no existing assignment)
      db.first.mockResolvedValueOnce(undefined);
      // Mock for the assignment insert
      db.returning.mockResolvedValueOnce([{
        id: 1,
        provider_id: 'provider-group-1',
        patient_id: 'patient-new',
        assigned_by: 'provider-1',
        status: 'active'
      }]);

      await PatientService.create({ first_name: 'New', ssn: '999-99-9999' }, assignedProvider);

      // Verify that assign was called (insert into provider_patient_assignments)
      expect(db).toHaveBeenCalledWith('provider_patient_assignments');
    });
  });

  describe('update', () => {
    it('should deny unassigned provider from updating patient', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        PatientService.update('patient-1', { first_name: 'Updated' }, unassignedProvider)
      ).rejects.toMatchObject({
        status: 403
      });
    });

    it('should allow admin to update any patient', async () => {
      db.returning.mockResolvedValue([{ id: 'patient-1', first_name: 'Updated' }]);

      const result = await PatientService.update('patient-1', { first_name: 'Updated' }, adminUser);
      expect(result).toEqual(expect.objectContaining({ first_name: 'Updated' }));
    });
  });
});

describe('RecordService - Access Control', () => {
  describe('getByPatient', () => {
    it('should allow assigned provider to get records for their patient', async () => {
      // Mock verifyAccess - provider is assigned
      db.first.mockResolvedValueOnce({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });
      // Mock records query
      db.orderBy.mockResolvedValueOnce([{ id: 'record-1', patient_id: 'patient-1' }]);

      const result = await RecordService.getByPatient('patient-1', assignedProvider);
      expect(result).toHaveLength(1);
    });

    it('should deny unassigned provider from getting patient records', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        RecordService.getByPatient('patient-1', unassignedProvider)
      ).rejects.toMatchObject({
        status: 403
      });
    });

    it('should allow admin to get any patient records', async () => {
      db.orderBy.mockResolvedValue([{ id: 'record-1', patient_id: 'patient-1' }]);

      const result = await RecordService.getByPatient('patient-1', adminUser);
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('should allow assigned provider to get a specific record', async () => {
      // Mock record lookup
      db.first.mockResolvedValueOnce({ id: 'record-1', patient_id: 'patient-1' });
      // Mock verifyAccess - provider is assigned
      db.first.mockResolvedValueOnce({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });

      const result = await RecordService.getById('record-1', assignedProvider);
      expect(result).toEqual(expect.objectContaining({ id: 'record-1' }));
    });

    it('should deny unassigned provider from getting a record', async () => {
      // Mock record lookup - record exists
      db.first.mockResolvedValueOnce({ id: 'record-1', patient_id: 'patient-1' });
      // Mock verifyAccess - provider is NOT assigned
      db.first.mockResolvedValueOnce(undefined);

      await expect(
        RecordService.getById('record-1', unassignedProvider)
      ).rejects.toMatchObject({
        status: 403
      });
    });

    it('should return 404 when record does not exist', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        RecordService.getById('nonexistent', assignedProvider)
      ).rejects.toMatchObject({
        status: 404
      });
    });

    it('should allow admin to get any record', async () => {
      db.first.mockResolvedValue({ id: 'record-1', patient_id: 'patient-1' });

      const result = await RecordService.getById('record-1', adminUser);
      expect(result).toEqual(expect.objectContaining({ id: 'record-1' }));
    });
  });

  describe('create', () => {
    it('should allow assigned provider to create a record', async () => {
      // Mock verifyAccess - provider is assigned
      db.first.mockResolvedValueOnce({ id: 1, provider_id: 'provider-group-1', patient_id: 'patient-1', status: 'active' });
      // Mock record insert
      db.returning.mockResolvedValueOnce([{ id: 'record-new', patient_id: 'patient-1', created_by: 'provider-1' }]);

      const result = await RecordService.create({ patient_id: 'patient-1', type: 'lab_result' }, assignedProvider);
      expect(result).toEqual(expect.objectContaining({ patient_id: 'patient-1' }));
    });

    it('should deny unassigned provider from creating a record for a patient', async () => {
      db.first.mockResolvedValue(undefined);

      await expect(
        RecordService.create({ patient_id: 'patient-1', type: 'lab_result' }, unassignedProvider)
      ).rejects.toMatchObject({
        status: 403
      });
    });

    it('should allow admin to create a record for any patient', async () => {
      db.returning.mockResolvedValue([{ id: 'record-new', patient_id: 'patient-1', created_by: 'admin-1' }]);

      const result = await RecordService.create({ patient_id: 'patient-1', type: 'lab_result' }, adminUser);
      expect(result).toEqual(expect.objectContaining({ patient_id: 'patient-1' }));
    });
  });
});
