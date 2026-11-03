import { NOTIFICATIONS_ID, RECAP_ID } from "@/lib/side-nav";
import type { Submission } from "@/lib/dashboard";
import type { HomeSection } from "./home-sections";
import { NotificationsAside, NotificationsView } from "./notifications-view";
import { RecapCard } from "./recap-card";
import { usePendingNotifications } from "./use-pending-notifications";

/**
 * Groupe du bas du rail : Notifications (tous les rôles, avec le compteur de la cloche) puis
 * Récapitulatif (managers seulement : ni le collaborateur ni l'admin ne l'ont).
 */
export function useBottomSections({
  email,
  role,
  onReadSubmission,
}: {
  email: string;
  role: string;
  onReadSubmission: (s: Submission) => void;
}): HomeSection[] {
  const unread = usePendingNotifications(email).data?.unread ?? 0;

  const sections: HomeSection[] = [
    {
      id: NOTIFICATIONS_ID,
      label: "Notifications",
      icon: "notifications",
      count: unread,
      ariaLabel: `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`,
      titleAside: (focusTitle) => <NotificationsAside email={email} focusTitle={focusTitle} />,
      panel: <NotificationsView email={email} onReadSubmission={onReadSubmission} />,
    },
  ];
  if (role === "manager") {
    sections.push({
      id: RECAP_ID,
      label: "Récapitulatif",
      icon: "summarize",
      panel: (
        <div className="max-w-xl">
          <RecapCard />
        </div>
      ),
    });
  }
  return sections;
}
