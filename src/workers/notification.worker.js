const { Worker } = require('bullmq');
const { Notification, Campaign } = require('../../models');
const {sendEmail} = require('../api/services/email.service');
const redis = require('../config/redis');

const worker = new Worker(
  'notificationQueue',
  async (job) => {

    const notificationId = job?.data?.notificationId;
    if (!notificationId) throw new Error('Missing notificationId in job data');

    const notification = await Notification.findByPk(notificationId);
    if (!notification) throw new Error(`Notification with ID ${notificationId} not found`);

    try {
      await notification.update({ status: 'PROCESSING' });

      // Simulate work (replace with actual send logic)
      await sendEmail({
        to: notification.sendTo,
        subject: "Notification Service",
        text: notification.message,
      })

      await notification.update({
        status: 'SUCCESS',
        attempts: job.attemptsMade + 1,
      });

      await Campaign.increment(
        { successCount: 1 },
        { where: { id: notification.campaignId } }
      );

      await updateCampaignStatus(notification.campaignId);

      return true;
    } catch (err) {
      // Update notification status on failure and rethrow to let BullMQ handle retries
      try {
        await notification.update({
          status: 'FAILED',
          attempts: job.attemptsMade + 1,
        });
        
      } catch (uErr) {
        console.error('Failed to update notification after job error:', uErr);
      }
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 5
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
    if(job.attemptsMade >= job.opts.attempts) {
        const notification = await Notification.findByPk(job.data.notificationId);
        await Campaign.increment(
            { failedCount: 1 },
            { where: { id: notification.campaignId } }
        );
        console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts. Final error:`, err?.message ?? err);
    }
});

const updateCampaignStatus = async (campaignId) => {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) throw new Error(`Campaign with ID ${campaignId} not found`);

    if(campaign.successCount + campaign.failedCount >= campaign.totalRecipients) {
        await campaign.update({ status: 'COMPLETED' });
    }
}

module.exports = worker;
