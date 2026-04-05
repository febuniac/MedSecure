const db = require('../models/db');

class ProviderPatientService {
  /**
   * Check if a provider is assigned to a specific patient.
   * Admin users bypass this check.
   */
  static async isAssigned(providerId, patientId) {
    const assignment = await db('provider_patient_assignments')
      .where({ provider_id: providerId, patient_id: patientId, status: 'active' })
      .first();
    return !!assignment;
  }

  /**
   * Verify that the requesting user has access to a patient.
   * Admins always have access. Providers must be assigned.
   * Throws 403 if access is denied.
   */
  static async verifyAccess(user, patientId) {
    if (user.role === 'admin') {
      return true;
    }

    const hasAccess = await ProviderPatientService.isAssigned(user.provider_id, patientId);
    if (!hasAccess) {
      const error = new Error('Access denied: provider not assigned to this patient');
      error.status = 403;
      throw error;
    }
    return true;
  }

  /**
   * Assign a provider to a patient.
   */
  static async assign(providerId, patientId, assignedBy) {
    const existing = await db('provider_patient_assignments')
      .where({ provider_id: providerId, patient_id: patientId, status: 'active' })
      .first();

    if (existing) {
      return existing;
    }

    const [assignment] = await db('provider_patient_assignments')
      .insert({
        provider_id: providerId,
        patient_id: patientId,
        assigned_by: assignedBy,
        status: 'active'
      })
      .returning('*');
    return assignment;
  }

  /**
   * Unassign a provider from a patient (soft delete by setting status to inactive).
   */
  static async unassign(providerId, patientId) {
    const [assignment] = await db('provider_patient_assignments')
      .where({ provider_id: providerId, patient_id: patientId, status: 'active' })
      .update({ status: 'inactive', updated_at: new Date() })
      .returning('*');
    return assignment;
  }

  /**
   * List all active patient assignments for a given provider.
   */
  static async listByProvider(providerId) {
    return db('provider_patient_assignments')
      .where({ provider_id: providerId, status: 'active' })
      .select('patient_id');
  }

  /**
   * List all active provider assignments for a given patient.
   */
  static async listByPatient(patientId) {
    return db('provider_patient_assignments')
      .where({ patient_id: patientId, status: 'active' })
      .select('provider_id');
  }
}

module.exports = ProviderPatientService;
