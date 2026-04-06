const PatientService = require('../src/services/patientService');
const db = require('../src/models/db');
const { AppError, ErrorCodes } = require('../src/utils/errorCodes');

jest.mock('../src/models/db', () => {
  const mKnex = jest.fn();
  return mKnex;
});

jest.mock('../src/services/providerPatientService');
jest.mock('../src/utils/encryption', () => ({
  encrypt: jest.fn((val) => `encrypted_${val}`),
  decrypt: jest.fn((val) => (val ? val.replace('encrypted_', '') : val)),
  hashSsn: jest.fn((val) => `hashed_${val.replace(/[^0-9]/g, '')}`),
}));

describe('PatientService.create - duplicate detection', () => {
  const adminUser = { id: 'admin-1', role: 'admin', provider_id: 'provider-admin' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create patient when no duplicate exists', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const ssnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{
        id: 'patient-new',
        mrn: 'MRN-100',
        first_name: 'Alice',
        last_name: 'Smith',
      }]),
    };

    let callCount = 0;
    db.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mrnQuery;   // MRN duplicate check
      if (callCount === 2) return ssnQuery;    // SSN duplicate check
      return insertQuery;                       // insert
    });

    const result = await PatientService.create({
      mrn: 'MRN-100',
      ssn: '123-45-6789',
      first_name: 'Alice',
      last_name: 'Smith',
    }, adminUser);

    expect(mrnQuery.where).toHaveBeenCalledWith({ mrn: 'MRN-100' });
    expect(ssnQuery.where).toHaveBeenCalledWith({ ssn_hash: 'hashed_123456789' });
    expect(insertQuery.insert).toHaveBeenCalled();
    expect(result).toEqual([{
      id: 'patient-new',
      mrn: 'MRN-100',
      first_name: 'Alice',
      last_name: 'Smith',
    }]);
  });

  it('should reject creation when MRN already exists', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'patient-existing',
        mrn: 'MRN-100',
      }),
    };

    db.mockImplementation(() => mrnQuery);

    await expect(
      PatientService.create({
        mrn: 'MRN-100',
        ssn: '999-99-9999',
        first_name: 'Bob',
        last_name: 'Jones',
      }, adminUser)
    ).rejects.toThrow('A patient with this MRN already exists');

    try {
      await PatientService.create({
        mrn: 'MRN-100',
        ssn: '999-99-9999',
        first_name: 'Bob',
        last_name: 'Jones',
      }, adminUser);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCodes.DUPLICATE_PATIENT);
      expect(err.status).toBe(409);
    }
  });

  it('should reject creation when SSN already exists', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const ssnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'patient-existing',
        ssn_hash: 'hashed_123456789',
      }),
    };

    let callCount = 0;
    db.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mrnQuery;
      return ssnQuery;
    });

    await expect(
      PatientService.create({
        mrn: 'MRN-200',
        ssn: '123-45-6789',
        first_name: 'Carol',
        last_name: 'White',
      }, adminUser)
    ).rejects.toThrow('A patient with this SSN already exists');

    callCount = 0;
    try {
      await PatientService.create({
        mrn: 'MRN-200',
        ssn: '123-45-6789',
        first_name: 'Carol',
        last_name: 'White',
      }, adminUser);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ErrorCodes.DUPLICATE_PATIENT);
      expect(err.status).toBe(409);
    }
  });

  it('should allow creation when patient has different MRN and SSN', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const ssnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{
        id: 'patient-new-2',
        mrn: 'MRN-300',
        first_name: 'Dave',
      }]),
    };

    let callCount = 0;
    db.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mrnQuery;
      if (callCount === 2) return ssnQuery;
      return insertQuery;
    });

    const result = await PatientService.create({
      mrn: 'MRN-300',
      ssn: '555-66-7777',
      first_name: 'Dave',
      last_name: 'Brown',
    }, adminUser);

    expect(result).toEqual([{ id: 'patient-new-2', mrn: 'MRN-300', first_name: 'Dave' }]);
  });

  it('should skip MRN check when MRN is not provided', async () => {
    const ssnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{
        id: 'patient-no-mrn',
        first_name: 'Eve',
      }]),
    };

    let callCount = 0;
    db.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return ssnQuery;
      return insertQuery;
    });

    const result = await PatientService.create({
      ssn: '111-22-3333',
      first_name: 'Eve',
      last_name: 'Green',
    }, adminUser);

    // Only 2 db calls: SSN check + insert (no MRN check)
    expect(callCount).toBe(2);
    expect(result).toEqual([{ id: 'patient-no-mrn', first_name: 'Eve' }]);
  });

  it('should store ssn_hash when creating patient with SSN', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const ssnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'patient-hash' }]),
    };

    let callCount = 0;
    db.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mrnQuery;
      if (callCount === 2) return ssnQuery;
      return insertQuery;
    });

    await PatientService.create({
      mrn: 'MRN-400',
      ssn: '444-55-6666',
      first_name: 'Frank',
    }, adminUser);

    const insertedData = insertQuery.insert.mock.calls[0][0];
    expect(insertedData.ssn_hash).toBe('hashed_444556666');
    expect(insertedData.ssn_encrypted).toBe('encrypted_444-55-6666');
    expect(insertedData.ssn).toBeUndefined();
  });

  it('should return 409 status for duplicate patient errors', async () => {
    const mrnQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'existing', mrn: 'MRN-DUP' }),
    };

    db.mockImplementation(() => mrnQuery);

    try {
      await PatientService.create({
        mrn: 'MRN-DUP',
        ssn: '000-00-0000',
        first_name: 'Test',
      }, adminUser);
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.code).toBe('DUPLICATE_PATIENT');
    }
  });
});
