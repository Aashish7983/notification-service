const express = require('express');
const redis = require('../config/redis');
const testRoute = require('./routes/test.route');
const notificationRoute = require('./routes/notification.route');
const bullBoardRoute = require('./routes/bullboard.route');
const campaignStatsRoute = require('./routes/campaignStats.route');

require('dotenv').config();
require('../workers/notification.worker');
const app = express();

app.use(express.json());

// Mount routes

app.use('/test', testRoute);
app.use('/notifications', notificationRoute);
app.use('/admin/queues', bullBoardRoute);
app.use('/campaigns', campaignStatsRoute);

app.get('/', (req, res) => {
    res.send('Notification Service is running');
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})