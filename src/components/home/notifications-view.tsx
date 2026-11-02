import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecapCard } from "./recap-card";
import { usePendingNotifications } from "./use-pending-notifications";
import {
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
  role,
  onBack,
  onReadSubmission,
}: {
  email: string;
  /** Rôle du connecté : la carte « Mon récapitulatif » n'est affichée qu'aux managers. */
  role: string;
  onBack: () => void;
  onReadSubmission: (s: Submission) => void;
}) {
  const qc = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Même requête que la cloche : liste et compteurs partagent la même règle et ne divergent jamais.
  const pending = usePendingNotifications(email);
  const items = pending.data?.items ?? [];
  const unreadCount = pending.data?.unread ?? 0;

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
        <p aria-live="polite" className="font-label-sm text-label-sm uppercase text-[#68686D]">
          {unreadCount} NON LUE{unreadCount > 1 ? "S" : ""}
        </p>
      </div>

      {/* Manager : deux cartes de même hauteur (Notifications, puis Récapitulatif) ; à 375 px elles
          s'empilent. Autres rôles : une seule colonne. */}
      <div className={role === "manager" ? "grid items-stretch gap-md md:grid-cols-2" : ""}>
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {role === "manager" && <RecapCard />}
      </div>
    </section>
  );
}
