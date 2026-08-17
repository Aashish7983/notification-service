const Redis = require('ioredis');

// Use explicit IP (avoid potential localhost IPv6 issues)
const redis = new Redis({
    host: '127.0.0.1',
    port: 6380,
    // Required by BullMQ for blocking commands
    maxRetriesPerRequest: null,
    // Retry strategy (ms) — increase delay between retries
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
    // Reconnect for connection-abort errors
    reconnectOnError(err) {
        if (!err) return false;
        // Let ioredis reconnect on ECONNABORTED and some transient errors
        if (err.code === 'ECONNABORTED') return true;
        return false;
    },
});

redis.on('connect', () => {
    console.log('Connected to Redis');
})

redis.on('error', (err) => {
    console.error('Redis error:', err);
})

module.exports = redis;