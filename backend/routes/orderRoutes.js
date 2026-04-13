const express = require('express');
const router = express.Router();
const { createOrder, addItemsToOrder, getOrders, updateOrderStatus, updateOrderCustomer, recordBillPrint, getAnalytics, updateOrderOwnerControls, updateOrderTableClearState } = require('../controllers/orderController');

router.get('/analytics', getAnalytics);
router.post('/', createOrder);
router.post('/:id/items', addItemsToOrder);
router.get('/', getOrders);
router.put('/:id/customer', updateOrderCustomer);
router.put('/:id/bill-print', recordBillPrint);
router.put('/:id/owner-controls', updateOrderOwnerControls);
router.put('/:id/table-clear', updateOrderTableClearState);
router.put('/:id/status', updateOrderStatus);

module.exports = router;
