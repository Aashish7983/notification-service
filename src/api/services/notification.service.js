const { Notification, Campaign } = require('../../../models');
const notificationQueue = require('../../queues/notification.queue');
const fs = require('fs');
const csv = require('csv-parser');

const sendNotificationByCsv = async(filePath, notificationData) => {
    if(!filePath) throw new Error("File path required");
    const {notificationType, message, campaignName} = notificationData;
    if(!notificationType, !message, !campaignName) throw new Error('Missing required fields');
    
   try {
     const emails = await extractEmailFromCsv(filePath);

    const uniqueEmails = [...new Set(emails)];

    const campaign = await Campaign.create({
        name: campaignName,
        status: 'CREATED',
        totalRecipients: uniqueEmails.length,
        successCount: 0,
        failedCount: 0
    })

    const notificationRows = uniqueEmails.map((email) => ({
        notificationType,
        sendTo: email,
        message,
        status: 'PENDING',
        attempts: 0,
        campaignId: campaign.id
    }))


    const notifications = await Notification.bulkCreate(
        notificationRows,
        {returning : true}
    );

    //prepare for bullmq jobs
    const jobs = notifications.map((notification)=> ({
        name: 'sendNotification',
        data: {
            notificationId : notification.id,
        },
        opts: {
            attempts: 3,
            backoff: {
                type : 'fixed',
                delay: 5000
            }
        }
    }));

    await notificationQueue.addBulk(jobs);

    fs.unlinkSync(filePath);

    return {
        totalNotifications: notifications.length,
    };
   } finally {
   if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
   }
}
}


const extractEmailFromCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const emails = [];

        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            if(row.email || row.EMAIL || row.Email){
                emails.push(row.email.trim());
            }
        })
        .on('end', ()=> {
            resolve(emails);
        })
        .on('error', reject);
    });
}

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

const sendBulkEmails = async (notificationData) => {
    const {notificationType, sendTo, message, campaignName} = notificationData;

    if(!notificationType, !sendTo, !message) throw new Error('Missing required fields');

    if(!Array.isArray(sendTo) || sendTo.length === 0) throw new Error('Send to must be non empty array');

    //creating rows for all recipients

    const uniqueEmails = [...new Set(sendTo)];

    const campaign = await Campaign.create({
        name: campaignName,
        status: 'CREATED',
        totalRecipients: uniqueEmails.length,
        successCount: 0,
        failedCount: 0
    })

    const notificationRows = uniqueEmails.map((email) => ({
        notificationType,
        sendTo: email,
        message,
        status: 'PENDING',
        attempts: 0,
        campaignId: campaign.id
    }))


    const notifications = await Notification.bulkCreate(
        notificationRows,
        {returning : true}
    );

    //prepare for bullmq jobs
    const jobs = notifications.map((notification)=> ({
        name: 'sendNotification',
        data: {
            notificationId : notification.id,
        },
        opts: {
            attempts: 3,
            backoff: {
                type : 'fixed',
                delay: 5000
            }
        }
    }));

    await notificationQueue.addBulk(jobs);

    return {
        totalNotifications: notifications.length,
    };
}

module.exports = {
    sendNotification,
    sendBulkEmails,
    extractEmailFromCsv,
    sendNotificationByCsv
};