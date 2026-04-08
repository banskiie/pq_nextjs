import Pusher from 'pusher-js';

// Singleton — one WebSocket connection shared by all components.
// Components must only unbind their own handlers on cleanup;
// they must NOT call unsubscribe() or disconnect() on the shared instance.
let _instance = null;
let _hasWarnedMissingConfig = false;

export function createPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    if ((key || cluster) && !_hasWarnedMissingConfig) {
      console.warn('Pusher is disabled: NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER is missing.');
      _hasWarnedMissingConfig = true;
    }
    return null;
  }

  if (!_instance) {
    _instance = new Pusher(key, { cluster });
  }

  return _instance;
}