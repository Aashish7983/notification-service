const notificationController = require('../controllers/notification.ctrl');
const express = require('express');
const router = express.Router();
const upload = require('../../config/multer');

router.post('/send-notification', notificationController.sendNotification);
router.post('/bulk-emails', notificationController.sendBulkEmails);
router.post('/sendNotificationByCsv', upload.single('file'), notificationController.sendNotificationByCsv)

module.exports = router;