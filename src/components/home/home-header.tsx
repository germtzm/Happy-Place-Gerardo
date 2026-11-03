import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth";
import { Icon } from "./icon";

export function HomeHeader({
  email,
  roleLabel,
  isAdmin,
}: {
  email: string;
  roleLabel: string;
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-sm mb-lg">
      <div className="space-y-sm">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
          Vue d'ensemble
        </p>
        <h1 className="font-headline-lg text-headline-lg text-primary">Happy Place</h1>
      </div>
      <div className="flex flex-wrap gap-xs items-center md:items-end md:justify-end">
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {email} · {roleLabel}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-xs px-md py-xs border border-outline bg-surface text-primary font-label-md text-label-md hover:bg-surface-container"
        >
          <Icon name="logout" /> DÉCONNEXION
        </button>
        {isAdmin && (<Link
          to="/manage/news"
          className="flex items-center gap-xs px-md py-xs border border-outline bg-surface text-primary font-label-md text-label-md hover:bg-surface-container transition-all"
        >
          <Icon name="database" /> GÉRER LES DONNÉES
        </Link>)}
      </div>
    </div>
  );
}
