import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck, Circle, Inbox, Radio, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useLocale } from '../contexts/LocaleContext';
import {
  disableGenesisPush,
  enableGenesisPush,
  getGenesisPushStatus,
} from '../services/pushNotifications';

const formatNotificationDate = (value, locale) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'es-US',
    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  ).format(date);
};

const notificationTypeLabel = (type, copy) => {
  const labels = {
    NEW_ATHLETE: copy('Nuevo atleta', 'New athlete'),
    PROGRAM_ACTIVATED: copy('Programa activado', 'Program activated'),
    PROGRAM_EXPIRING: copy('Programa por vencer', 'Program expiring'),
    ROUTINE_REVIEW: copy('Auditor\u00eda requerida', 'Review required'),
    ADMIN_REQUEST: copy('Solicitud administrativa', 'Administrative request'),
    ACCOUNT_SECURITY: copy('Seguridad de cuenta', 'Account security'),
  };

  return labels[type] || copy('Actividad del sistema', 'System activity');
};

const notificationMessage = (type, copy, fallback) => {
  const messages = {
    NEW_ATHLETE: copy(
      'Se registr\u00f3 un atleta nuevo. Revisa el roster para consultar la informaci\u00f3n autorizada.',
      'A new athlete registered. Review the roster for authorized information.'
    ),
    ADMIN_REQUEST: copy(
      'Un coach envi\u00f3 una solicitud administrativa. Revisa la bandeja de gesti\u00f3n.',
      'A coach submitted an administrative request. Review the management inbox.'
    ),
    PROGRAM_ACTIVATED: copy(
      'Se actualiz\u00f3 el estado de un programa.',
      'A program status was updated.'
    ),
    PROGRAM_EXPIRING: copy(
      'Un programa requiere seguimiento de vencimiento.',
      'A program requires expiration follow-up.'
    ),
    ROUTINE_REVIEW: copy(
      'Hay una revisi\u00f3n operativa pendiente.',
      'There is an operational review pending.'
    ),
    ACCOUNT_SECURITY: copy(
      'Se registr\u00f3 un evento de seguridad de cuenta.',
      'An account security event was recorded.'
    ),
  };

  return messages[type] || fallback;
};
export default function NotificationCenter({
  showSystemActivity = false,
  panelClass = 'bg-[#111] text-white',
  borderClass = 'border-neutral-800',
  accentClass = 'text-amber-500',
  className = '',
  onInboxChange = null,
  onNotificationOpen = null,
}) {
  const { locale } = useLocale();
  const copy = (es, en) => (locale === 'en' ? en : es);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState([]);
  const [systemActivity, setSystemActivity] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activeView, setActiveView] = useState('INBOX');

  const [pushStatus, setPushStatus] = useState({
    supported: false,
    permission: 'default',
    subscribed: false,
    vapidConfigured: false,
  });

  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState(null);

  const readCount = useMemo(
    () => inbox.filter((notification) => notification.read).length,
    [inbox]
  );

  const unreadCount = useMemo(
    () => inbox.filter((notification) => !notification.read).length,
    [inbox]
  );

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setInbox([]);
        setSystemActivity([]);
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: ownNotifications, error: ownError } = await supabase
        .from('system_notifications')
        .select('id, recipient_role, recipient_id, title, message, type, resource_type, resource_id, read, created_at')
        .eq('recipient_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (ownError) throw ownError;

      setInbox(ownNotifications || []);

      if (showSystemActivity) {
        const { data: observedNotifications, error: observedError } = await supabase
          .from('system_notifications')
          .select('id, recipient_role, recipient_id, title, message, type, resource_type, resource_id, read, created_at')
          .neq('recipient_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(12);

        if (observedError) throw observedError;

        setSystemActivity(observedNotifications || []);
      } else {
        setSystemActivity([]);
      }
    } catch (error) {
      console.error('Genesis notification center error:', error);
      setInbox([]);
      setSystemActivity([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [showSystemActivity]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const channel = supabase
      .channel(`genesis-notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_notifications',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          loadNotifications();

          if (payload.eventType === 'INSERT') {
            onInboxChange?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, showSystemActivity]);

  const loadPushStatus = async () => {
    try {
      const status =
        await getGenesisPushStatus();

      setPushStatus(status);
    } catch (error) {
      console.error(
        'Genesis push status error:',
        error
      );

      setPushStatus({
        supported: false,
        permission: 'unsupported',
        subscribed: false,
        vapidConfigured: false,
      });
    }
  };

  useEffect(() => {
    if (!currentUserId) {
      setPushStatus({
        supported: false,
        permission: 'default',
        subscribed: false,
        vapidConfigured: false,
      });

      setPushMessage(null);

      return;
    }

    loadPushStatus();
  }, [currentUserId]);

  const getPushFailureMessage = (code) => {
    const messages = {
      PUSH_UNSUPPORTED: copy(
        'Este navegador o dispositivo no admite Web Push.',
        'This browser or device does not support Web Push.'
      ),
      VAPID_PUBLIC_KEY_NOT_CONFIGURED: copy(
        'Push todavía no está configurado para este entorno.',
        'Push is not configured for this environment yet.'
      ),
      PERMISSION_DENIED: copy(
        'Las notificaciones están bloqueadas en el navegador. Puedes habilitarlas desde los permisos del sitio.',
        'Notifications are blocked in the browser. You can enable them from the site permissions.'
      ),
      PERMISSION_NOT_GRANTED: copy(
        'No se concedió permiso para las notificaciones.',
        'Notification permission was not granted.'
      ),
      ACCOUNT_NOT_ACTIVE: copy(
        'Tu cuenta debe estar activa para registrar este dispositivo.',
        'Your account must be active to register this device.'
      ),
      SUBSCRIPTION_OWNERSHIP_CONFLICT: copy(
        'Este navegador tiene una suscripción Push vinculada a otra identidad Genesis.',
        'This browser has a Push subscription linked to another Genesis identity.'
      ),
      PUSH_UNREGISTER_FAILED: copy(
        'Genesis no pudo desregistrar este dispositivo.',
        'Genesis could not unregister this device.'
      ),
      PUSH_UNREGISTER_DENIED: copy(
        'Genesis rechazó la solicitud de desregistro Push.',
        'Genesis rejected the Push unregister request.'
      ),
      BROWSER_UNSUBSCRIBE_FAILED: copy(
        'El navegador no pudo eliminar completamente la suscripción Push.',
        'The browser could not fully remove the Push subscription.'
      ),
      PUSH_REGISTRATION_FAILED: copy(
        'Genesis no pudo registrar este dispositivo para Push.',
        'Genesis could not register this device for Push.'
      ),
    };

    return (
      messages[code] ||
      copy(
        'No fue posible cambiar la configuración Push.',
        'The Push setting could not be changed.'
      )
    );
  };

  const handlePushToggle = async () => {
    if (
      pushBusy ||
      !currentUserId
    ) {
      return;
    }

    setPushBusy(true);
    setPushMessage(null);

    try {
      const result =
        pushStatus.subscribed
          ? await disableGenesisPush()
          : await enableGenesisPush();

      if (!result?.ok) {
        setPushMessage(
          getPushFailureMessage(
            result?.code
          )
        );

        await loadPushStatus();

        return;
      }

      await loadPushStatus();

      setPushMessage(
        pushStatus.subscribed
          ? copy(
              'Push fue desactivado para este dispositivo.',
              'Push was disabled for this device.'
            )
          : copy(
              'Este dispositivo quedó registrado para Push.',
              'This device is registered for Push.'
            )
      );
    } catch (error) {
      console.error(
        'Genesis push toggle error:',
        error
      );

      setPushMessage(
        copy(
          'Ocurrió un error al actualizar Push.',
          'An error occurred while updating Push.'
        )
      );

      await loadPushStatus();
    } finally {
      setPushBusy(false);
    }
  };

  const pushStatusText = (() => {
    if (!pushStatus.supported) {
      return copy(
        'Push no disponible en este navegador.',
        'Push is unavailable in this browser.'
      );
    }

    if (!pushStatus.vapidConfigured) {
      return copy(
        'Push no está configurado para este entorno.',
        'Push is not configured for this environment.'
      );
    }

    if (pushStatus.permission === 'denied') {
      return copy(
        'Bloqueado por los permisos del navegador.',
        'Blocked by browser permissions.'
      );
    }

    if (pushStatus.subscribed) {
      return copy(
        'Este dispositivo está registrado.',
        'This device is registered.'
      );
    }

    return copy(
      'Push está disponible para este dispositivo.',
      'Push is available for this device.'
    );
  })();

  const pushActionDisabled =
    pushBusy ||
    !currentUserId ||
    !pushStatus.supported ||
    !pushStatus.vapidConfigured ||
    (
      pushStatus.permission === 'denied' &&
      !pushStatus.subscribed
    );

  const openCenter = () => {
    setIsOpen((current) => !current);

    if (!isOpen) {
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!currentUserId || unreadCount === 0) return;

    const { error } = await supabase
      .from('system_notifications')
      .update({ read: true })
      .eq('recipient_id', currentUserId)
      .eq('read', false);

    if (error) {
      console.error('Genesis notification read-all error:', error);
      return;
    }

    setInbox((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
  };

  const markAsRead = async (notification) => {
    if (!currentUserId || notification.recipient_id !== currentUserId || notification.read) {
      return;
    }

    const { error } = await supabase
      .from('system_notifications')
      .update({ read: true })
      .eq('id', notification.id)
      .eq('recipient_id', currentUserId);

    if (error) {
      console.error('Genesis notification read error:', error);
      return;
    }

    setInbox((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item
      )
    );
  };

  const clearReadNotifications = async () => {
    if (!currentUserId || readCount === 0) return;

    const confirmed = window.confirm(
      copy(
        'Eliminar todas las alertas leÃ­das de tu bandeja?',
        'Remove all read alerts from your inbox?'
      )
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('system_notifications')
      .delete()
      .eq('recipient_id', currentUserId)
      .eq('read', true);

    if (error) {
      console.error('Genesis notification clear-read error:', error);
      return;
    }

    setInbox((current) =>
      current.filter((notification) => !notification.read)
    );
  };
  const visibleNotifications =
    activeView === 'SYSTEM' ? systemActivity : inbox;

  return (
    <div className={'relative ' + className}>
      <button
        type="button"
        onClick={openCenter}
        className={'relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-black/20 transition-colors hover:bg-black/10 ' + borderClass}
        title={copy('Notificaciones', 'Notifications')}
        aria-label={copy('Abrir notificaciones', 'Open notifications')}
        aria-expanded={isOpen}
      >
        {unreadCount > 0 ? (
          <BellRing size={18} className={accentClass} />
        ) : (
          <Bell size={18} />
        )}
        {unreadCount > 0 && (
          <span className={'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black px-1 text-[9px] font-black text-black ' + (accentClass === 'text-amber-500' ? 'bg-amber-500' : 'bg-white')}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className={'absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden border genesis-panel shadow-2xl ' + borderClass + ' ' + panelClass}
          aria-label={copy('Centro de notificaciones', 'Notification center')}
        >
          <div className={'flex items-start justify-between border-b px-5 py-4 ' + borderClass}>
            <div>
              <p className={'text-[10px] font-black uppercase tracking-[0.18em] ' + accentClass}>
                {copy('Centro de notificaciones', 'Notification center')}
              </p>
              <h2 className="mt-1 text-sm font-black uppercase tracking-tight">
                {copy('Actividad que requiere atenci\u00f3n', 'Activity requiring attention')}
              </h2>
            </div>
            {activeView === 'INBOX' && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider opacity-70 transition hover:opacity-100"
              >
                <CheckCheck size={14} />
                {copy('Le\u00eddas', 'Read')}
              </button>
            )}
          </div>

          {activeView === 'INBOX' && (
            <div className={'border-b px-4 py-3 ' + borderClass}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                    {copy('Push del dispositivo', 'Device Push')}
                  </p>

                  <p className="mt-1 text-[9px] font-mono leading-relaxed opacity-60">
                    {pushStatusText}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePushToggle}
                  disabled={pushActionDisabled}
                  className={
                    'shrink-0 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition ' +
                    borderClass +
                    (
                      pushActionDisabled
                        ? ' cursor-not-allowed opacity-35'
                        : ' hover:bg-black/10'
                    )
                  }
                >
                  {pushBusy
                    ? copy('Procesando...', 'Working...')
                    : pushStatus.subscribed
                      ? copy('Desactivar', 'Disable')
                      : copy('Activar', 'Enable')}
                </button>
              </div>

              {pushMessage && (
                <p className={'mt-2 text-[9px] font-mono leading-relaxed ' + accentClass}>
                  {pushMessage}
                </p>
              )}
            </div>
          )}

          {activeView === 'INBOX' && readCount > 0 && (
            <div className={'border-b px-4 py-2 text-right ' + borderClass}>
              <button
                type="button"
                onClick={clearReadNotifications}
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider opacity-70 transition hover:opacity-100"
              >
                <Trash2 size={13} />
                {copy('Limpiar le\u00eddas', 'Clear read')}
              </button>
            </div>
          )}
          {showSystemActivity && (
            <div className={'flex gap-2 border-b px-4 py-3 ' + borderClass}>
              <button
                type="button"
                onClick={() => setActiveView('INBOX')}
                className={'rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ' + (activeView === 'INBOX' ? 'bg-black/20' : 'opacity-50 hover:opacity-100')}
              >
                <span className="inline-flex items-center gap-2">
                  <Inbox size={13} />
                  {copy('Mi bandeja', 'My inbox')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('SYSTEM')}
                className={'rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ' + (activeView === 'SYSTEM' ? 'bg-black/20' : 'opacity-50 hover:opacity-100')}
              >
                <span className="inline-flex items-center gap-2">
                  <Radio size={13} />
                  {copy('Actividad', 'Activity')}
                </span>
              </button>
            </div>
          )}

          <div className="max-h-[26rem] overflow-y-auto p-2">
            {loading ? (
              <div className="px-4 py-10 text-center text-xs font-mono opacity-60">
                {copy('Cargando alertas...', 'Loading alerts...')}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Inbox size={26} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs font-mono opacity-60">
                  {activeView === 'SYSTEM'
                    ? copy('No hay actividad reciente.', 'No recent activity.')
                    : copy('No tienes alertas pendientes.', 'You have no pending alerts.')}
                </p>
              </div>
            ) : (
              visibleNotifications.map((notification) => {
                const canMarkRead =
                  activeView === 'INBOX' &&
                  notification.recipient_id === currentUserId &&
                  !notification.read;

                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => {
                      if (canMarkRead) markAsRead(notification);

                      if (
                        activeView === 'INBOX' &&
                        notification.recipient_id === currentUserId
                      ) {
                        onNotificationOpen?.(notification);
                      }
                    }}
                    className={'w-full rounded-xl px-3 py-3 text-left transition-colors ' + (canMarkRead ? 'hover:bg-black/10' : 'cursor-default') + (!notification.read && activeView === 'INBOX' ? ' bg-black/10' : '')}
                  >
                    <div className="flex gap-3">
                      <div className="pt-1">
                        <Circle
                          size={9}
                          fill="currentColor"
                          className={!notification.read && activeView === 'INBOX' ? accentClass : 'opacity-20'}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-[11px] font-black uppercase tracking-wide">
                            {notificationTypeLabel(notification.type, copy)}
                          </p>
                          <span className="shrink-0 text-[9px] font-mono opacity-50">
                            {formatNotificationDate(notification.created_at, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed opacity-65">
                          {notificationMessage(notification.type, copy, notification.message)}
                        </p>
                        <p className={'mt-2 text-[9px] font-black uppercase tracking-widest ' + accentClass}>
                          {notificationTypeLabel(notification.type, copy)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
