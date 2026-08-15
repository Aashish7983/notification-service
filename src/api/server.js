const express = require('express');
const redis = require('../config/redis');

require('../workers/notification.worker');
const app = express();

app.use(express.json());

// Mount routes
const testRoute = require('./routes/test.route');
app.use('/test', testRoute);

app.get('/', (req, res) => {
    res.send('Notification Service is running');
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})