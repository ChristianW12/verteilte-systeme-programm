const { createClient } = require('redis');

let client = null;

// Singleton: Gibt Redis-Verbindung zurück oder erstellt sie
async function getClient() {
  if (!client) {
    client = createClient({ url: 'redis://' + (process.env.REDIS_HOST || 'redis') + ':6379' });
    client.on('error', (err) => console.error('[Redis] Client Error', err));
    await client.connect();
    console.log('[Redis] Connected');
  }
  return client;
}

// Publiziert Event über Redis Pub/Sub an WebSocket-Server
async function publishEvent(eventType, payload) {
  const redis = await getClient();
  const event = {
    type: eventType,
    payload,
    timestamp: new Date().toISOString()
  };
  await redis.publish('realtime.events', JSON.stringify(event));
  console.log('[realtime] Event published:', eventType);
}

module.exports = { getClient, publishEvent };