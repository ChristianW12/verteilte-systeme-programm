'use strict';

const { WebSocketServer } = require('ws');
const { createClient } = require('redis');

const PORT = Number(process.env.PORT || 4000);
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_CHANNEL = process.env.REDIS_CHANNEL || 'realtime.events';

const wss = new WebSocketServer({
  port: PORT,
  path: '/ws',
});

const clients = new Set();

wss.on('connection', (socket) => {
  clients.add(socket);

  socket.send(JSON.stringify({
    type: 'system.connected',
    payload: { message: 'WebSocket verbunden', timestamp: new Date().toISOString() }
  }));

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

// Versendet Nachricht an alle verbundenen WebSocket-Clients
function broadcast(rawMessage) {
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(rawMessage);
    }
  }
}

// Abonniert Redis-Channel und versendet Events an alle WS-Clients
async function startRedisBridge() {
  const subscriber = createClient({ url: 'redis://' + REDIS_HOST + ':' + REDIS_PORT });

  subscriber.on('error', (error) => {
    console.error('[websockets] redis error:', error.message);
  });

  await subscriber.connect();
  
  await subscriber.subscribe(REDIS_CHANNEL, (message) => {
    console.log('[websockets] received event from', REDIS_CHANNEL);
    broadcast(message);
  });

  console.log('[websockets] subscribed to', REDIS_CHANNEL);
  console.log('[websockets] listening on /ws port', PORT);
}

startRedisBridge().catch((error) => {
  console.error('[websockets] startup failed', error);
  process.exit(1);
});