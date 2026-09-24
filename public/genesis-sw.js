const GENESIS_DEFAULT_TARGET = "/";

const GENESIS_ROLE_TARGETS = Object.freeze({
  SUPER_ADMIN: "/super-admin",
  COACH: "/coach/notifications",
  ATHLETE: "/client",
});

const GENESIS_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeText = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
};

const safeTargetUrl = (value) => {
  try {
    const url = new URL(
      typeof value === "string" ? value : GENESIS_DEFAULT_TARGET,
      self.location.origin,
    );

    if (url.origin !== self.location.origin) {
      return GENESIS_DEFAULT_TARGET;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return GENESIS_DEFAULT_TARGET;
  }
};

const resolveNotificationTarget = (payload) => {
  const notificationType = safeText(payload?.notification_type, 64)
    .toUpperCase();

  const resourceType = safeText(payload?.resource_type, 64).toUpperCase();

  const resourceId = safeText(payload?.resource_id, 128);

  const recipientRole = safeText(payload?.recipient_role, 32).toUpperCase();

  if (
    notificationType === "NEW_ATHLETE" &&
    resourceType === "ATHLETE" &&
    GENESIS_UUID_RE.test(resourceId) &&
    (recipientRole === "SUPER_ADMIN" || recipientRole === "COACH")
  ) {
    return safeTargetUrl(
      `/coach/client/${encodeURIComponent(resourceId)}`,
    );
  }

  if (
    notificationType === "ADMIN_REQUEST" &&
    resourceType === "ADMIN_REQUEST" &&
    GENESIS_UUID_RE.test(resourceId) &&
    recipientRole === "SUPER_ADMIN"
  ) {
    return GENESIS_ROLE_TARGETS.SUPER_ADMIN;
  }

  if (
    resourceType === "CHAT_MESSAGE" &&
    GENESIS_UUID_RE.test(resourceId)
  ) {
    return "/chat";
  }

  return (
    GENESIS_ROLE_TARGETS[recipientRole] ||
    GENESIS_DEFAULT_TARGET
  );
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
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

  const title = safeText(payload.title, 120) ||
    "Genesis OS";

  const body = safeText(
    payload.body || payload.message,
    300,
  ) ||
    "Genesis notification";

  const options = {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: {
      url: resolveNotificationTarget(payload),
      notificationId: safeText(payload.notification_id, 128) ||
        null,
    },
  };

  const tag = safeText(payload.tag, 128);

  if (tag) {
    options.tag = tag;
  }

  event.waitUntil(
    self.registration.showNotification(
      title,
      options,
    ),
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl = safeTargetUrl(
      event.notification?.data?.url,
    );

    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        for (const client of windows) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Keep the existing window if navigation
              // is unavailable for this client.
            }
          }

          if ("focus" in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(
            targetUrl,
          );
        }

        return undefined;
      })(),
    );
  },
);
