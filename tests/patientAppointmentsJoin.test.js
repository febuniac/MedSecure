const PatientService = require('../src/services/patientService');
const db = require('../src/models/db');

jest.mock('../src/models/db', () => {
  const mKnex = jest.fn();
  return mKnex;
});

jest.mock('../src/services/providerPatientService');
jest.mock('../src/utils/encryption', () => ({
  encrypt: jest.fn((val) => `encrypted_${val}`),
  decrypt: jest.fn((val) => val ? val.replace('encrypted_', '') : val),
}));

describe('PatientService.list — N+1 fix with JOIN', () => {
  const providerUser = { id: 'user-1', role: 'provider', provider_id: 'provider-1' };
  const adminUser = { id: 'admin-1', role: 'admin', provider_id: 'provider-admin' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildJoinQuery(resolvedRows) {
    const query = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve(resolvedRows)),
    };
    return query;
  }

  it('should use LEFT JOIN to fetch patients with appointments in a single query', async () => {
    const joinRows = [
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-2', appointment_date: '2026-06-15', appointment_status: 'pending' },
      { id: 'p2', first_name: 'Jane', last_name: 'Smith', dob: '1985-05-10', created_at: '2026-01-02', appointment_id: null, appointment_date: null, appointment_status: null },
    ];

    const joinQuery = buildJoinQuery(joinRows);
    db.mockImplementation(() => joinQuery);

    const result = await PatientService.list({}, adminUser);

    expect(db).toHaveBeenCalledWith('patients');
    expect(joinQuery.leftJoin).toHaveBeenCalledWith(
      'appointments', 'patients.id', 'appointments.patient_id'
    );
    expect(result).toHaveLength(2);
    expect(result[0].appointments).toHaveLength(2);
    expect(result[1].appointments).toHaveLength(0);
  });

  it('should group multiple appointments under one patient instead of duplicating rows', async () => {
    const joinRows = [
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-2', appointment_date: '2026-06-15', appointment_status: 'pending' },
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-3', appointment_date: '2026-07-01', appointment_status: 'cancelled' },
    ];

    const joinQuery = buildJoinQuery(joinRows);
    db.mockImplementation(() => joinQuery);

    const result = await PatientService.list({}, adminUser);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].appointments).toHaveLength(3);
    expect(result[0].appointments.map(a => a.id)).toEqual(['apt-1', 'apt-2', 'apt-3']);
    expect(result[0].appointments[0]).toEqual({
      id: 'apt-1',
      appointment_date: '2026-06-01',
      status: 'confirmed',
    });
  });

  it('should handle patients with no appointments (LEFT JOIN null rows)', async () => {
    const joinRows = [
      { id: 'p1', first_name: 'Alice', last_name: 'A', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: null, appointment_date: null, appointment_status: null },
    ];

    const joinQuery = buildJoinQuery(joinRows);
    db.mockImplementation(() => joinQuery);

    const result = await PatientService.list({}, adminUser);

    expect(result).toHaveLength(1);
    expect(result[0].appointments).toEqual([]);
  });

  it('should filter by provider assignments and still use JOIN', async () => {
    const assignmentsQuery = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([{ patient_id: 'p1' }]),
    };

    const joinRows = [
      { id: 'p1', first_name: 'John', last_name: 'Doe', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
    ];

    const joinQuery = buildJoinQuery(joinRows);

    db.mockImplementation((table) => {
      if (table === 'provider_patient_assignments') return assignmentsQuery;
      if (table === 'patients') return joinQuery;
      return {};
    });

    const result = await PatientService.list({}, providerUser);

    expect(assignmentsQuery.where).toHaveBeenCalledWith({
      provider_id: 'provider-1',
      status: 'active',
    });
    expect(joinQuery.leftJoin).toHaveBeenCalledWith(
      'appointments', 'patients.id', 'appointments.patient_id'
    );
    expect(joinQuery.whereIn).toHaveBeenCalledWith('patients.id', ['p1']);
    expect(result).toHaveLength(1);
    expect(result[0].appointments).toHaveLength(1);
  });

  it('should return empty array when provider has no patient assignments', async () => {
    const assignmentsQuery = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    };
    const joinQuery = buildJoinQuery([]);

    db.mockImplementation((table) => {
      if (table === 'provider_patient_assignments') return assignmentsQuery;
      if (table === 'patients') return joinQuery;
      return {};
    });

    const result = await PatientService.list({}, providerUser);

    expect(result).toEqual([]);
  });

  it('should not make N+1 queries (only 1 query for admin, 2 for provider)', async () => {
    const joinRows = [
      { id: 'p1', first_name: 'A', last_name: 'A', dob: '1990-01-01', created_at: '2026-01-01', appointment_id: 'apt-1', appointment_date: '2026-06-01', appointment_status: 'confirmed' },
      { id: 'p2', first_name: 'B', last_name: 'B', dob: '1991-01-01', created_at: '2026-01-02', appointment_id: 'apt-2', appointment_date: '2026-07-01', appointment_status: 'pending' },
    ];

    const joinQuery = buildJoinQuery(joinRows);
    db.mockImplementation(() => joinQuery);

    await PatientService.list({}, adminUser);

    // Admin: only 1 call to db('patients') — no separate per-patient appointment queries
    expect(db).toHaveBeenCalledTimes(1);
    expect(db).toHaveBeenCalledWith('patients');
  });
});
