const express = require('express');
const router = express.Router();
const {
  getPublicMenu,
  createPublicOrder,
  getPublicOrderStatus,
  getTableQrCodes
} = require('../controllers/publicController');

router.get('/menu', getPublicMenu);
router.post('/order', createPublicOrder);
router.get('/order-status', getPublicOrderStatus);
router.get('/qr-tables', getTableQrCodes);

module.exports = router;
