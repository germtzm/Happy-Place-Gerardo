import { Icon } from "./icon";
import { usePendingNotifications } from "./use-pending-notifications";

/** Cloche des notifications : nombre de notifications à traiter ; le clic ouvre la vue Notifications. */
export function NotificationBell({ email, onOpen }: { email: string; onOpen: () => void }) {
  // Rafraîchie au retour du focus de l'onglet (comportement par défaut de TanStack Query,
  // basé sur visibilitychange) et par invalidation de ["notifications"] après une soumission ou une décision.
  const pending = usePendingNotifications(email);
  const count = pending.data?.unread ?? 0;

  return (
    <button
      type="button"
      id="notification-bell"
      onClick={onOpen}
      aria-label={`Notifications, ${count} non lue${count > 1 ? "s" : ""}`}
      className="relative flex min-h-[44px] min-w-[44px] items-center justify-center p-xs text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Icon name="notifications" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-[2px] -top-[2px] min-w-[18px] rounded-[4px] bg-error px-[4px] text-center font-label-sm text-[11px] leading-[18px] text-white"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
