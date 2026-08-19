const notificationService = require('../services/notification.service');

const sendNotification = async (req, res) => {
    try {
        const notification = await notificationService.sendNotification(req.body);
        res.status(201).json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const sendBulkEmails = async (req, res) => {
    try{
        const result = await notificationService.sendBulkEmails(req.body);
        res.status(201).json({
            success: true,
            ...result,
        });
    } catch (err){
        res.status(500).json({
            success: false,
            error: err.message
        })
    }
}

const sendNotificationByCsv = async (req, res) => {
    try{
        const filePath = req.file.path;
        // const notificationData = {
        //     notificationType, sendTo, message, campaignName
        // } = req.body;
        const result = await notificationService.sendNotificationByCsv(filePath, req.body);
        res.status(201).json({
            success: true,
            ...result,
        });
    } catch (err){
        res.status(500).json({
            success: false,
            error: err.message
        })
    }
}

module.exports = {
    sendNotification,
    sendBulkEmails,
    sendNotificationByCsv
};