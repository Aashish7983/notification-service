const { Worker } = require('bullmq');
const { Notification, Campaign } = require('../../models');
const { sendEmail } = require('../api/services/email.service');
const redis = require('../config/redis');

const worker = new Worker(
  'notificationQueue',
  async (job) => {
    const notificationId = job?.data?.notificationId;
    if (!notificationId) {
      throw new Error('Missing notificationId in job data');
    }
    const notification = await Notification.findByPk(notificationId);
    if(!notification) throw new Error(`Notification of id ${notificationId} not found`);
      if(notification?.status === "SUCCESS") return;
      
       await Notification.update(
          {
            status: 'PROCESSING'
          },
          {
            where: {
              id: notificationId
            }
          }
        );

        await sendEmail({
          to : notification.sendTo,
          subject: 'Notification Service',
          text: notification.message
        });

        await Notification.update(
          {
            status: 'SUCCESS',
            attempts: job.attemptsMade + 1,
            sendAt: new Date()
          },
          {
            where: {
              id: notificationId
            }
          }
        );

        if(notification?.campaignId){
          await Campaign.increment(
          { successCount: 1 },
          {
            where: {
              id: notification.campaignId
            }
          }
        );
        await updateCampaignStatus(notification.campaignId);
        }

        return true;
  },
  {
    connection: redis,
    concurrency: 5,

    limiter: {
      max: 20,
      duration: 1000
    }
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(
    `job ${job?.id} failed:`,
    err?.message || err
  );
});

const updateCampaignStatus = async (campaignId) => {

  const campaign = await Campaign.findByPk(campaignId);

  if (!campaign) {
    return;
  }

  const totalProcessed =
    campaign.successCount + campaign.failedCount;

  if (totalProcessed >= campaign.totalRecipients) {

    await campaign.update({
      status: 'COMPLETED'
    });

    console.log(
      `Campaign ${campaignId} completed`
    );
  }
};

module.exports = worker;