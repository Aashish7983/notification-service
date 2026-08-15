const { Worker } = require('bullmq');

const redis = require('../config/redis');

const worker = new Worker(
  "notificationQueue",
  async (job) => {
    console.log(
      `Processing job ${job.id} with data: ${JSON.stringify(job.data)}`
    );

    throw new Error("Testing Retry");
  },
  {
    connection: redis,
  }
);

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
});
