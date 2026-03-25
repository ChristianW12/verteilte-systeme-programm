const { createClient } = require('redis');

let publisher = null;

async function initPublisher() {
  publisher = createClient({ url: 'redis://' + (process.env.REDIS_HOST || 'redis') + ':6379' });
  await publisher.connect();
  console.log('[realtime] Publisher connected to Redis');
}

async function publishEvent(eventType, payload) {
  if (!publisher) await initPublisher();
  
  const event = {
    type: eventType,
    payload,
    timestamp: new Date().toISOString()
  };
  
  await publisher.publish('realtime.events', JSON.stringify(event));
  console.log('[realtime] Event published:', eventType);
}

module.exports = { initPublisher, publishEvent };