const notificationQueue = require('../../queues/notification.queue');

const router = require('express').Router();

router.post("/", async (req, res) => {

  await notificationQueue.add(
    "send-notification",
    {
      userId: 5,
      message: "Hello good",
    },
    {
        attempts: 3, 
        backoff: {
            type: "fixed",
            delay: 1000, 
        },
    }
  );

  res.send("Job Added");
});

module.exports = router;