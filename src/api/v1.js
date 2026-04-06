const router = require('express').Router();
const authMiddleware = require('../middleware/auth');

// Authenticated routes
router.use('/patients', authMiddleware, require('./patients'));
router.use('/records', authMiddleware, require('./records'));
router.use('/appointments', authMiddleware, require('./appointments'));
router.use('/prescriptions', authMiddleware, require('./prescriptions'));
router.use('/providers', authMiddleware, require('./providers'));
router.use('/consent', authMiddleware, require('./consent'));
router.use('/provider-assignments', authMiddleware, require('./providerAssignments'));
router.use('/breach-notifications', authMiddleware, require('./breachNotification'));
router.use('/baa-agreements', authMiddleware, require('./baaAgreements'));
router.use('/backup-verification', authMiddleware, require('./backupVerification'));
router.use('/fhir/r4', authMiddleware, require('./fhir'));

// Public routes (no auth required)
router.use('/auth', require('./auth'));

module.exports = router;
