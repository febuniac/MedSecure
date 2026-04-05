const router = require('express').Router();
const ConsentService = require('../services/consentService');

router.get('/patient/:patientId', async (req, res) => {
  const consents = await ConsentService.getByPatient(req.params.patientId);
  res.json(consents);
});
router.post('/', async (req, res) => {
  const consent = await ConsentService.create(req.body, req.user);
  res.status(201).json(consent);
});
router.put('/:id/revoke', async (req, res) => {
  const consent = await ConsentService.revoke(req.params.id, req.user);
  res.json(consent);
});
module.exports = router;
