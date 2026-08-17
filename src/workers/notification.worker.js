const { Worker } = require('bullmq');
const { Notification } = require('../../models');
const redis = require('../config/redis');

const worker = new Worker(
  'notificationQueue',
  async (job) => {
    console.log(`Processing job ${job.id} with data: ${JSON.stringify(job.data)}`);

    const notificationId = job?.data?.notificationId;
    if (!notificationId) throw new Error('Missing notificationId in job data');

    const notification = await Notification.findByPk(notificationId);
    if (!notification) throw new Error(`Notification with ID ${notificationId} not found`);

    try {
      await notification.update({ status: 'PROCESSING' });

      // Simulate work (replace with actual send logic)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await notification.update({
        status: 'SUCCESS',
        attempts: job.attemptsMade + 1,
      });

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
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    if(job.attemptsMade >= job.opts.attempts) {
        console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts. Final error:`, err?.message ?? err);
    }
});

module.exports = worker;
