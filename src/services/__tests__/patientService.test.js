const PatientService = require('../patientService');
const ProviderPatientService = require('../providerPatientService');
const db = require('../../models/db');

jest.mock('../../models/db', () => {
  const mKnex = jest.fn();
  mKnex.mockReturnValue({
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    first: jest.fn(),
    select: jest.fn(),
  });
  return mKnex;
});

jest.mock('../providerPatientService');
jest.mock('../../utils/encryption', () => ({
  encrypt: jest.fn((val) => `encrypted_${val}`),
  decrypt: jest.fn((val) => val ? val.replace('encrypted_', '') : val),
}));

describe('PatientService', () => {
  const providerUser = { id: 'user-1', role: 'provider', provider_id: 'provider-1' };
  const adminUser = { id: 'admin-1', role: 'admin', provider_id: 'provider-admin' };
  const otherProvider = { id: 'user-2', role: 'provider', provider_id: 'provider-2' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    function buildJoinQuery(resolvedRows) {
      const query = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(resolvedRows),
        whereIn: jest.fn().mockReturnThis(),
      };
      return query;
    }

    it('should return patients with appointments using JOIN for provider', async () => {
      const joinRows = [
        { id: 'patient-1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
        { id: 'patient-1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-2', appointment_date: '2026-06-15', appointment_status: 'pending' },
        { id: 'patient-2', first_name: 'Jane', last_name: 'Smith', dob: '1985-05-10', created_at: '2026-01-02', appointment_id: null, appointment_date: null, appointment_status: null },
      ];

      const assignmentsQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([
          { patient_id: 'patient-1' },
          { patient_id: 'patient-2' },
        ]),
      };

      const joinQuery = buildJoinQuery(joinRows);

      db.mockImplementation((table) => {
        if (table === 'provider_patient_assignments') return assignmentsQuery;
        if (table === 'patients') return joinQuery;
        return {};
      });

      const result = await PatientService.list({}, providerUser);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('patient-1');
      expect(result[0].appointments).toHaveLength(2);
      expect(result[0].appointments[0].id).toBe('apt-1');
      expect(result[0].appointments[1].id).toBe('apt-2');
      expect(result[1].id).toBe('patient-2');
      expect(result[1].appointments).toHaveLength(0);
      expect(joinQuery.leftJoin).toHaveBeenCalledWith('appointments', 'patients.id', 'appointments.patient_id');
      expect(assignmentsQuery.where).toHaveBeenCalledWith({
        provider_id: 'provider-1',
        status: 'active',
      });
    });

    it('should return empty array when provider has no assignments', async () => {
      const assignmentsQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([]),
      };
      db.mockImplementation(() => assignmentsQuery);

      const result = await PatientService.list({}, otherProvider);

      expect(result).toEqual([]);
    });

    it('should return all patients with appointments for admin users using JOIN', async () => {
      const joinRows = [
        { id: 'patient-1', first_name: 'Alice', last_name: 'A', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-10', appointment_date: '2026-07-01', appointment_status: 'confirmed' },
        { id: 'patient-2', first_name: 'Bob', last_name: 'B', dob: '1991-02-02', created_at: '2026-01-02', appointment_id: null, appointment_date: null, appointment_status: null },
        { id: 'patient-3', first_name: 'Carol', last_name: 'C', dob: '1992-03-03', created_at: '2026-01-03', appointment_id: 'apt-11', appointment_date: '2026-07-15', appointment_status: 'pending' },
      ];

      const joinQuery = buildJoinQuery(joinRows);
      db.mockImplementation(() => joinQuery);

      const result = await PatientService.list({}, adminUser);

      expect(result).toHaveLength(3);
      expect(db).toHaveBeenCalledWith('patients');
      expect(joinQuery.leftJoin).toHaveBeenCalledWith('appointments', 'patients.id', 'appointments.patient_id');
      expect(result[0].appointments).toHaveLength(1);
      expect(result[1].appointments).toHaveLength(0);
      expect(result[2].appointments).toHaveLength(1);
    });

    it('should group multiple appointments under the same patient', async () => {
      const joinRows = [
        { id: 'patient-1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
        { id: 'patient-1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-2', appointment_date: '2026-06-15', appointment_status: 'pending' },
        { id: 'patient-1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-3', appointment_date: '2026-07-01', appointment_status: 'cancelled' },
      ];

      const joinQuery = buildJoinQuery(joinRows);
      db.mockImplementation(() => joinQuery);

      const result = await PatientService.list({}, adminUser);

      expect(result).toHaveLength(1);
      expect(result[0].appointments).toHaveLength(3);
      expect(result[0].appointments.map(a => a.id)).toEqual(['apt-1', 'apt-2', 'apt-3']);
    });
  });

  describe('getById', () => {
    it('should return patient when provider is assigned', async () => {
      ProviderPatientService.verifyAccess.mockResolvedValue(true);
      const mockPatient = { id: 'patient-1', first_name: 'John', ssn_encrypted: 'encrypted_123-45-6789' };
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPatient),
      };
      db.mockImplementation(() => mockQuery);

      const result = await PatientService.getById('patient-1', providerUser);

      expect(ProviderPatientService.verifyAccess).toHaveBeenCalledWith(providerUser, 'patient-1');
      expect(result.ssn).toBe('123-45-6789');
    });

    it('should deny access when provider is not assigned to patient', async () => {
      const accessError = new Error('Access denied: provider not assigned to this patient');
      accessError.status = 403;
      ProviderPatientService.verifyAccess.mockRejectedValue(accessError);

      try {
        await PatientService.getById('patient-1', otherProvider);
        fail('Expected an error to be thrown');
      } catch (err) {
        expect(err.status).toBe(403);
        expect(err.message).toContain('Access denied');
      }
    });

    it('should allow admin to access any patient', async () => {
      ProviderPatientService.verifyAccess.mockResolvedValue(true);
      const mockPatient = { id: 'patient-1', first_name: 'John', ssn_encrypted: 'encrypted_123-45-6789' };
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockPatient),
      };
      db.mockImplementation(() => mockQuery);

      const result = await PatientService.getById('patient-1', adminUser);

      expect(result.first_name).toBe('John');
    });
  });

  describe('update', () => {
    it('should update patient when provider is assigned', async () => {
      ProviderPatientService.verifyAccess.mockResolvedValue(true);
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'patient-1', first_name: 'John Updated' }]),
      };
      db.mockImplementation(() => mockQuery);

      const result = await PatientService.update('patient-1', { first_name: 'John Updated' }, providerUser);

      expect(ProviderPatientService.verifyAccess).toHaveBeenCalledWith(providerUser, 'patient-1');
      expect(result.first_name).toBe('John Updated');
    });

    it('should deny update when provider is not assigned', async () => {
      const accessError = new Error('Access denied: provider not assigned to this patient');
      accessError.status = 403;
      ProviderPatientService.verifyAccess.mockRejectedValue(accessError);

      try {
        await PatientService.update('patient-1', { first_name: 'Hacked' }, otherProvider);
        fail('Expected an error to be thrown');
      } catch (err) {
        expect(err.status).toBe(403);
      }
    });
  });
});
