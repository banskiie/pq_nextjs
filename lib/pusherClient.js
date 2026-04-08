import Pusher from 'pusher-js';

let hasWarnedAboutMissingPusherConfig = false;

export function createPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  const hasAnyConfig = Boolean(key || cluster);

  if (!key || !cluster) {
    if (hasAnyConfig && !hasWarnedAboutMissingPusherConfig) {
      console.warn('Pusher is disabled because NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER is missing.');
      hasWarnedAboutMissingPusherConfig = true;
    }
    return null;
  }

  return new Pusher(key, { cluster });
}