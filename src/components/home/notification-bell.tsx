import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchUnreadNotificationCount } from "@/lib/dashboard";
import { Icon } from "./icon";

/** Cloche des notifications : nombre de non lues du connecté (la vue détaillée arrive en T10). */
export function NotificationBell({ email }: { email: string }) {
  // Rafraîchie au retour du focus de l'onglet (comportement par défaut de TanStack Query,
  // basé sur visibilitychange) et par invalidation de ["notifications"] après une soumission ou une décision.
  const unread = useQuery({
    queryKey: ["notifications", "unread", email],
    queryFn: fetchUnreadNotificationCount,
    enabled: !!email,
    retry: false,
  });
  const count = unread.data ?? 0;

  return (
    <button
      type="button"
      onClick={() => toast.info("Bientôt disponible")}
      aria-label={`Notifications, ${count} non lue${count > 1 ? "s" : ""}`}
      className="relative flex items-center p-xs text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
