const notificationController = require('../controllers/notification.ctrl');
const express = require('express');
const router = express.Router();

router.post('/send-notification', notificationController.sendNotification);
router.post('/bulk-emails', notificationController.sendBulkEmails);

module.exports = router;