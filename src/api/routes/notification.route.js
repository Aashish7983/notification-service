const notificationController = require('../controllers/notification.ctrl');
const express = require('express');
const router = express.Router();

router.post('/send-notification', notificationController.sendNotification);

module.exports = router;