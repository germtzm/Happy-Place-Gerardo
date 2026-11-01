import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  notificationExcerpt,
  notificationTitle,
  timeAgo,
  type NotificationItem,
  type Submission,
} from "@/lib/dashboard";

/** Vue « Notifications » affichée à la place de l'accueil (qui reste monté, donc l'onglet actif est conservé). */
export function NotificationsView({
  email,
  onBack,
  onReadSubmission,
}: {
  email: string;
  onBack: () => void;
  onReadSubmission: (s: Submission) => void;
}) {
  const qc = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const list = useQuery({
    queryKey: ["notifications", "list", email],
    queryFn: fetchNotifications,
    enabled: !!email,
    retry: false,
  });
  // Même clé que la cloche : le compteur reste cohérent avec la pastille.
  const unread = useQuery({
    queryKey: ["notifications", "unread", email],
    queryFn: fetchUnreadNotificationCount,
    enabled: !!email,
    retry: false,
  });
  const unreadCount = unread.data ?? 0;

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
    <section aria-labelledby="notifications-title" className="space-y-md">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center font-label-md text-label-md uppercase text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        ← RETOUR À L'ACCUEIL
      </button>

      <div className="flex flex-wrap items-end justify-between gap-sm">
        <h1
          id="notifications-title"
          ref={titleRef}
          tabIndex={-1}
          className="font-headline-lg text-headline-lg text-primary focus:outline-none"
        >
          Notifications
        </h1>
        <p
          aria-live="polite"
          className="font-label-sm text-label-sm uppercase text-[#68686D]"
        >
          {unreadCount} NON LUE{unreadCount > 1 ? "S" : ""}
        </p>
      </div>

      {list.isLoading ? (
        <p className="text-body-md text-[#68686D]">Chargement…</p>
      ) : list.isError ? (
        <p role="alert" className="text-body-md text-error">
          Impossible de charger les notifications.
        </p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="rounded-[8px] border border-[#CDCDD1] bg-white p-md text-body-md text-[#68686D]">
          Aucune notification.
        </p>
      ) : (
        <ul className="divide-y divide-[#CDCDD1] overflow-hidden rounded-[8px] border border-[#CDCDD1] bg-white">
          {(list.data ?? []).map((n) => {
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
