const db = require('../models/db');

class RecordService {
  static async getByPatient(patientId, user) {
    return db('medical_records').where({ patient_id: patientId }).orderBy('date', 'desc');
  }
  static async getById(id, user) {
    return db('medical_records').where({ id }).first();
  }
  static async create(data, user) {
    data.created_by = user.id;
    return db('medical_records').insert(data).returning('*');
  }
}
module.exports = RecordService;
