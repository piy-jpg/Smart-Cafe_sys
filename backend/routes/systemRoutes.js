const express = require('express');
const router = express.Router();
const { downloadDatabaseBackup, downloadSqlExport, getDatabaseStatus, getOwnerControlCenter, updateOwnerControlCenter } = require('../controllers/systemController');

router.get('/database/status', getDatabaseStatus);
router.get('/database/download', downloadDatabaseBackup);
router.get('/database/export-sql', downloadSqlExport);
router.get('/owner-control', getOwnerControlCenter);
router.put('/owner-control', updateOwnerControlCenter);

module.exports = router;
