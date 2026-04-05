const router = require('express').Router();
const ProviderPatientService = require('../services/providerPatientService');

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign providers to patients' });
    }
    const { provider_id, patient_id } = req.body;
    if (!provider_id || !patient_id) {
      return res.status(400).json({ error: 'provider_id and patient_id are required' });
    }
    const assignment = await ProviderPatientService.assign(provider_id, patient_id, req.user.id);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can unassign providers from patients' });
    }
    const { provider_id, patient_id } = req.body;
    if (!provider_id || !patient_id) {
      return res.status(400).json({ error: 'provider_id and patient_id are required' });
    }
    const assignment = await ProviderPatientService.unassign(provider_id, patient_id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(assignment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/patient/:patientId', async (req, res) => {
  try {
    const providers = await ProviderPatientService.listByPatient(req.params.patientId);
    res.json(providers);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/provider/:providerId', async (req, res) => {
  try {
    const patients = await ProviderPatientService.listByProvider(req.params.providerId);
    res.json(patients);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
