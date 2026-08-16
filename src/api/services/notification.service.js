const { Notification } = require('../../../models');
const notificationQueue = require('../../queues/notification.queue');

const sendNotification = async (notificationData) => {
    const {notificationType, sendTo, message} = notificationData;

    if(!notificationType || !sendTo || !message) {
        throw new Error("Missing required fields");
    }

    const notification = await Notification.create({
        notificationType,
        sendTo,
        message,
        status: 'PENDING'
    });

    await notificationQueue.add('sendNotification', { notificationId: notification.id });

    return notification;
};

module.exports = {
    sendNotification
};