import { supabase } from '../supabaseClient';

const SERVICE_WORKER_URL =
  '/genesis-sw.js';

const SERVICE_WORKER_SCOPE =
  '/';

const getConfiguredVapidPublicKey = () => {
  const key =
    import.meta.env
      .VITE_GENESIS_VAPID_PUBLIC_KEY;

  if (
    typeof key !== 'string' ||
    !key.trim()
  ) {
    return null;
  }

  return key.trim();
};

const base64UrlToUint8Array = (
  value
) => {
  const normalized =
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  const padding =
    '='.repeat(
      (4 - (normalized.length % 4)) % 4
    );

  const raw =
    window.atob(
      normalized + padding
    );

  const bytes =
    new Uint8Array(raw.length);

  for (
    let index = 0;
    index < raw.length;
    index += 1
  ) {
    bytes[index] =
      raw.charCodeAt(index);
  }

  return bytes;
};

const arrayBufferToBase64Url = (
  buffer
) => {
  if (!buffer) {
    return null;
  }

  const bytes =
    new Uint8Array(buffer);

  let binary = '';

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const serializeSubscription = (
  subscription
) => {
  const json =
    subscription.toJSON();

  const p256dh =
    json.keys?.p256dh ||
    arrayBufferToBase64Url(
      subscription.getKey('p256dh')
    );

  const auth =
    json.keys?.auth ||
    arrayBufferToBase64Url(
      subscription.getKey('auth')
    );

  if (
    !subscription.endpoint ||
    !p256dh ||
    !auth
  ) {
    throw new Error(
      'GENESIS_PUSH_SUBSCRIPTION_KEYS_MISSING'
    );
  }

  return {
    endpoint:
      subscription.endpoint,

    p256dh,

    auth,

    expiresAt:
      typeof subscription.expirationTime ===
        'number'
        ? new Date(
            subscription.expirationTime
          ).toISOString()
        : null,
  };
};

export const isGenesisPushSupported =
  () => {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined'
    ) {
      return false;
    }

    return (
      window.isSecureContext === true &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  };

export const registerGenesisServiceWorker =
  async () => {
    if (!isGenesisPushSupported()) {
      return null;
    }

    await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      {
        scope: SERVICE_WORKER_SCOPE,
      }
    );

    return navigator.serviceWorker.ready;
  };

export const getGenesisPushStatus =
  async () => {
    const supported =
      isGenesisPushSupported();

    if (!supported) {
      return {
        supported: false,
        permission:
          'Notification' in window
            ? Notification.permission
            : 'unsupported',
        subscribed: false,
        vapidConfigured:
          Boolean(
            getConfiguredVapidPublicKey()
          ),
      };
    }

    const registration =
      await registerGenesisServiceWorker();

    const subscription =
      await registration
        .pushManager
        .getSubscription();

    return {
      supported: true,
      permission:
        Notification.permission,
      subscribed:
        Boolean(subscription),
      vapidConfigured:
        Boolean(
          getConfiguredVapidPublicKey()
        ),
    };
  };

const registerSubscriptionWithGenesis =
  async (subscription) => {
    const serialized =
      serializeSubscription(
        subscription
      );

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'genesis_register_push_subscription',
        {
          p_endpoint:
            serialized.endpoint,

          p_p256dh:
            serialized.p256dh,

          p_auth_secret:
            serialized.auth,

          p_expires_at:
            serialized.expiresAt,

          p_user_agent:
            typeof navigator.userAgent ===
              'string'
              ? navigator.userAgent.slice(
                  0,
                  1024
                )
              : null,
        }
      );

    if (error) {
      throw error;
    }

    if (!data?.allowed) {
      const registrationError =
        new Error(
          data?.code ||
          'GENESIS_PUSH_REGISTRATION_DENIED'
        );

      registrationError.code =
        data?.code ||
        'GENESIS_PUSH_REGISTRATION_DENIED';

      throw registrationError;
    }

    return {
      subscription,
      subscriptionId:
        data.subscription_id ||
        null,
    };
  };

export const enableGenesisPush =
  async () => {
    if (!isGenesisPushSupported()) {
      return {
        ok: false,
        code: 'PUSH_UNSUPPORTED',
      };
    }

    const publicKey =
      getConfiguredVapidPublicKey();

    if (!publicKey) {
      return {
        ok: false,
        code:
          'VAPID_PUBLIC_KEY_NOT_CONFIGURED',
      };
    }

    let permission =
      Notification.permission;

    if (permission === 'default') {
      permission =
        await Notification
          .requestPermission();
    }

    if (permission !== 'granted') {
      return {
        ok: false,
        code:
          permission === 'denied'
            ? 'PERMISSION_DENIED'
            : 'PERMISSION_NOT_GRANTED',
        permission,
      };
    }

    const registration =
      await registerGenesisServiceWorker();

    let subscription =
      await registration
        .pushManager
        .getSubscription();

    let createdSubscription =
      false;

    if (!subscription) {
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly: true,

            applicationServerKey:
              base64UrlToUint8Array(
                publicKey
              ),
          });

      createdSubscription = true;
    }

    try {
      const registered =
        await registerSubscriptionWithGenesis(
          subscription
        );

      return {
        ok: true,
        code: 'OK',
        permission,
        subscriptionId:
          registered.subscriptionId,
      };
    } catch (error) {
      if (createdSubscription) {
        try {
          await subscription.unsubscribe();
        } catch {
          // Best-effort rollback.
        }
      }

      console.error(
        'Genesis push registration error:',
        error
      );

      return {
        ok: false,
        code:
          error?.code ||
          'PUSH_REGISTRATION_FAILED',
      };
    }
  };

export const disableGenesisPush =
  async () => {
    if (!isGenesisPushSupported()) {
      return {
        ok: false,
        code: 'PUSH_UNSUPPORTED',
      };
    }

    const registration =
      await registerGenesisServiceWorker();

    const subscription =
      await registration
        .pushManager
        .getSubscription();

    if (!subscription) {
      return {
        ok: true,
        code: 'ALREADY_DISABLED',
      };
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'genesis_unregister_push_subscription',
        {
          p_endpoint:
            subscription.endpoint,
        }
      );

    if (error) {
      console.error(
        'Genesis push unregister error:',
        error
      );

      return {
        ok: false,
        code:
          'PUSH_UNREGISTER_FAILED',
      };
    }

    if (!data?.allowed) {
      return {
        ok: false,
        code:
          data?.code ||
          'PUSH_UNREGISTER_DENIED',
      };
    }

    const unsubscribed =
      await subscription.unsubscribe();

    return {
      ok: unsubscribed,
      code:
        unsubscribed
          ? 'OK'
          : 'BROWSER_UNSUBSCRIBE_FAILED',
    };
  };