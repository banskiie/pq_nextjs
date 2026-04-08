import Pusher from 'pusher';
import { PUSHER_CHANNEL, PUSHER_EVENTS } from '@/lib/pusherEvents';

export { PUSHER_CHANNEL, PUSHER_EVENTS };

// Pusher server client - only used in API routes (server-side)
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

export default pusherServer;
