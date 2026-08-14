const Redis = require('ioredis');

const redis = new Redis({
    host: "localhost",
    port: 6380,
});

redis.on('connect', () => {
    console.log('Connected to Redis');
})

redis.on('error', (err) => {
    console.error('Redis error:', err);
})

module.exports = redis;