import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePendingNotifications } from "./use-pending-notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationExcerpt,
  notificationTitle,
  timeAgo,
  type NotificationItem,
  type Submission,
} from "@/lib/dashboard";

/**
 * À droite du titre de la section Notifications : « N NON LUES » et « TOUT MARQUER COMME LU ».
 * Même requête que la cloche et la liste : les compteurs ne divergent jamais.
 * `focusTitle` redonne le focus au titre de la section quand le bouton disparaît.
 */
export function NotificationsAside({
  email,
  focusTitle,
}: {
  email: string;
  focusTitle: () => void;
}) {
  const qc = useQueryClient();
  const pending = usePendingNotifications(email);
  const unreadCount = pending.data?.unread ?? 0;

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notifications marquées comme lues.");
      // Le bouton disparaît : le focus revient au titre plutôt que de se perdre.
      focusTitle();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-wrap items-center gap-sm">
      <p aria-live="polite" className="font-label-sm text-label-sm uppercase text-[#68686D]">
        {unreadCount} NON LUE{unreadCount > 1 ? "S" : ""}
      </p>
      {unreadCount > 0 && (
        <button
          type="button"
          disabled={markAllRead.isPending}
          aria-busy={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-primary px-md font-label-md text-label-md uppercase text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          TOUT MARQUER COMME LU
        </button>
      )}
    </div>
  );
}

/** Liste de la section « Notifications » du menu (le titre et les compteurs sont fournis par la page). */
export function NotificationsView({
  email,
  onReadSubmission,
}: {
  email: string;
  onReadSubmission: (s: Submission) => void;
}) {
  const qc = useQueryClient();

  // Même requête que la cloche : liste et compteurs partagent la même règle et ne divergent jamais.
  const pending = usePendingNotifications(email);
  const items = pending.data?.items ?? [];

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  function openSubmission(n: NotificationItem) {
    if (!n.submission) return;
    if (!n.read_at) markRead.mutate(n.id);
    onReadSubmission(n.submission);
  }

  return (
    <div className="min-w-0">
      {pending.isLoading ? (
        <p className="text-body-md text-[#68686D]">Chargement…</p>
      ) : pending.isError ? (
        <p role="alert" className="text-body-md text-error">
          Impossible de charger les notifications.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-[8px] border border-[#CDCDD1] bg-white p-md text-body-md text-[#68686D]">
          Aucune notification à traiter.
        </p>
      ) : (
        <ul className="h-full divide-y divide-[#CDCDD1] overflow-hidden rounded-[8px] border border-[#CDCDD1] bg-white">
          {items.map((n) => {
            const excerpt = notificationExcerpt(n.submission?.content);
            return (
              <li key={n.id} className="flex items-start gap-sm p-sm md:p-md">
                <span
                  aria-hidden="true"
                  className={`mt-[7px] h-[10px] w-[10px] shrink-0 rounded-full ${
                    n.read_at ? "bg-transparent" : "bg-[#F0D0BC]"
                  }`}
                />
                <div className="min-w-0 flex-1 space-y-xs">
                  <p className="text-body-md font-bold text-primary wrap-anywhere">
                    {!n.read_at && <span className="sr-only">Non lue. </span>}
                    {notificationTitle(n)}
                  </p>
                  {excerpt && (
                    <p className="text-body-sm text-[#68686D] wrap-anywhere">{excerpt}</p>
                  )}
                  <p className="font-label-sm text-label-sm uppercase text-[#68686D]">
                    {timeAgo(n.created_at)}
                  </p>
                  {n.submission && (
                    <button
                      type="button"
                      onClick={() => openSubmission(n)}
                      className="inline-flex min-h-[44px] items-center font-label-md text-label-md uppercase text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      VOIR LA DEMANDE →
                    </button>
                  )}
                  {/* Demande supprimée par son auteur : pas de demande à ouvrir, donc le marquage « lu »
                      passe par ce bouton (seule read_at change). Une fois lue, la règle commune la masque. */}
                  {!n.submission && n.deleted_by_author_at && !n.read_at && (
                    <button
                      type="button"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                      aria-label="Marquer comme lue : demande supprimée par son auteur"
                      className="inline-flex min-h-[44px] items-center font-label-md text-label-md uppercase text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      MARQUER COMME LUE
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
