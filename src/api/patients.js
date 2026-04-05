const router = require('express').Router();
const PatientService = require('../services/patientService');

router.get('/', async (req, res) => {
  const patients = await PatientService.list(req.query, req.user);
  res.json(patients);
});
router.get('/:id', async (req, res) => {
  const patient = await PatientService.getById(req.params.id, req.user);
  res.json(patient);
});
router.post('/', async (req, res) => {
  const patient = await PatientService.create(req.body, req.user);
  res.status(201).json(patient);
});
router.put('/:id', async (req, res) => {
  const patient = await PatientService.update(req.params.id, req.body, req.user);
  res.json(patient);
});
module.exports = router;
