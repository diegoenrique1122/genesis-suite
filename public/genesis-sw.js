const GENESIS_DEFAULT_TARGET = '/';

const safeText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
};

const safeTargetUrl = (value) => {
  try {
    const url = new URL(
      typeof value === 'string' ? value : GENESIS_DEFAULT_TARGET,
      self.location.origin
    );

    if (url.origin !== self.location.origin) {
      return GENESIS_DEFAULT_TARGET;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return GENESIS_DEFAULT_TARGET;
  }
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        body: event.data.text(),
      };
    }
  }

  const title =
    safeText(payload.title, 120) ||
    'Genesis OS';

  const body =
    safeText(
      payload.body || payload.message,
      300
    ) ||
    'Genesis notification';

  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: safeTargetUrl(
        payload.url ||
        payload.target_url ||
        GENESIS_DEFAULT_TARGET
      ),
      notificationId:
        safeText(payload.notification_id, 128) ||
        null,
    },
  };

  const tag =
    safeText(payload.tag, 128);

  if (tag) {
    options.tag = tag;
  }

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const targetUrl =
      safeTargetUrl(
        event.notification?.data?.url
      );

    event.waitUntil(
      (async () => {
        const windows =
          await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });

        for (const client of windows) {
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Keep the existing window if navigation
              // is unavailable for this client.
            }
          }

          if ('focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(
            targetUrl
          );
        }

        return undefined;
      })()
    );
  }
);