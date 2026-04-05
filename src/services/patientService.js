const db = require('../models/db');
const { encrypt, decrypt } = require('../utils/encryption');

class PatientService {
  static async list(filters, user) {
    return db('patients').where({ provider_id: user.provider_id }).select('id', 'first_name', 'last_name', 'dob', 'created_at');
  }
  static async getById(id, user) {
    const patient = await db('patients').where({ id }).first();
    if (patient) { patient.ssn = await decrypt(patient.ssn_encrypted); }
    return patient;
  }
  static async create(data, user) {
    data.ssn_encrypted = await encrypt(data.ssn);
    delete data.ssn;
    return db('patients').insert(data).returning('*');
  }
}
module.exports = PatientService;
