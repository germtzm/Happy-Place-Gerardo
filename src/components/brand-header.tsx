import { Link } from "@tanstack/react-router";
import sharkLogo from "@/assets/bigger-boat-shark.png";
import { NotificationBell } from "@/components/home/notification-bell";

/**
 * `email` et `onOpenNotifications` : renseignés sur l'accueil pour afficher la cloche des notifications
 * (elle reste visible et ouvre la section Notifications du menu).
 */
export function BrandHeader({
  email,
  onOpenNotifications,
}: {
  email?: string;
  onOpenNotifications?: () => void;
}) {
  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto flex min-h-16 w-full max-w-interface items-center justify-between gap-md px-sm py-xs md:px-md">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-sm"
          aria-label="Bigger Boat — accueil"
        >
          <img
            src={sharkLogo}
            alt=""
            width={1024}
            height={1024}
            className="h-11 w-14 shrink-0 object-contain"
          />
          <span className="font-label-md text-lg font-bold uppercase text-primary">
            Bigger Boat
          </span>
        </Link>
        <div className="flex items-center gap-xs">
          <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">
            Happy Place
          </span>
          {email && onOpenNotifications && (
            <NotificationBell email={email} onOpen={onOpenNotifications} />
          )}
        </div>
      </div>
    </header>
  );
}
