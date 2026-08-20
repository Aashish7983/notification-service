const { Worker } = require('bullmq');
const { Notification, Campaign } = require('../../models');
const { sendEmail } = require('../api/services/email.service');
const redis = require('../config/redis');

const worker = new Worker(
  'notificationQueue',
  async (job) => {

    const notifications = job?.data?.notifications;

    if (!notifications?.length) {
      throw new Error('Missing notifications in job data');
    }

    const campaignId = notifications[0].campaignId;

    for (const notification of notifications) {

      try {

        await Notification.update(
          {
            status: 'PROCESSING'
          },
          {
            where: {
              id: notification.id
            }
          }
        );

        await sendEmail(
          notification.sendTo,
          'Notification Service',
          notification.message
        );

        await Notification.update(
          {
            status: 'SUCCESS',
            attempts: job.attemptsMade + 1,
            sendAt: new Date()
          },
          {
            where: {
              id: notification.id
            }
          }
        );

        await Campaign.increment(
          { successCount: 1 },
          {
            where: {
              id: campaignId
            }
          }
        );

      } catch (err) {

        console.error(
          `Failed email for ${notification.sendTo}:`,
          err.message
        );

        await Notification.update(
          {
            status: 'FAILED',
            attempts: job.attemptsMade + 1
          },
          {
            where: {
              id: notification.id
            }
          }
        );

        await Campaign.increment(
          { failedCount: 1 },
          {
            where: {
              id: campaignId
            }
          }
        );
      }
    }

    await updateCampaignStatus(campaignId);

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
    `Batch job ${job?.id} failed:`,
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