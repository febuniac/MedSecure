const router = require('express').Router();
const db = require('../models/db');

router.get('/', async (req, res) => {
  try {
    const providers = await db('providers').select('*');
    res.json(providers);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const provider = await db('providers').where({ id: req.params.id }).first();
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(provider);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
