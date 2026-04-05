const db = require('../models/db');
const { encrypt, decrypt } = require('../utils/encryption');
const ProviderPatientService = require('./providerPatientService');

class PatientService {
  static async list(filters, user) {
    if (user.role === 'admin') {
      return db('patients').select('id', 'first_name', 'last_name', 'dob', 'created_at');
    }

    const assignments = await ProviderPatientService.listByProvider(user.provider_id);
    const patientIds = assignments.map(a => a.patient_id);

    return db('patients')
      .whereIn('id', patientIds)
      .select('id', 'first_name', 'last_name', 'dob', 'created_at');
  }

  static async getById(id, user) {
    await ProviderPatientService.verifyAccess(user, id);

    const patient = await db('patients').where({ id }).first();
    if (!patient) {
      const error = new Error('Patient not found');
      error.status = 404;
      throw error;
    }
    if (patient.ssn_encrypted) {
      patient.ssn = decrypt(patient.ssn_encrypted);
    }
    return patient;
  }

  static async create(data, user) {
    data.ssn_encrypted = encrypt(data.ssn);
    delete data.ssn;
    data.created_by = user.id;
    const [patient] = await db('patients').insert(data).returning('*');

    // Auto-assign the creating provider to this patient
    await ProviderPatientService.assign(user.provider_id, patient.id, user.id);

    return patient;
  }

  static async update(id, data, user) {
    await ProviderPatientService.verifyAccess(user, id);

    const [patient] = await db('patients')
      .where({ id })
      .update(data)
      .returning('*');

    if (!patient) {
      const error = new Error('Patient not found');
      error.status = 404;
      throw error;
    }
    return patient;
  }
}

module.exports = PatientService;
