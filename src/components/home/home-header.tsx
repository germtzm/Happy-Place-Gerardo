import { Link } from "@tanstack/react-router";
import { Icon } from "./icon";

/** Sous le bandeau fixe : seul l'accès admin aux données reste ici (titre, compte et déconnexion sont dans le bandeau). */
export function HomeHeader({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  return (
    <div className="mb-lg flex flex-wrap items-center justify-end gap-xs">
      <Link
        to="/manage/news"
        className="flex min-h-[44px] items-center gap-xs border border-outline bg-surface px-md py-xs font-label-md text-label-md text-primary transition-all hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Icon name="database" /> GÉRER LES DONNÉES
      </Link>
    </div>
  );
}
