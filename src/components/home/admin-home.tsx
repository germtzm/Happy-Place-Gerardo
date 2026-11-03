import { Link } from "@tanstack/react-router";
import { DepartureNotices } from "@/components/departure-notices";
import { StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function AdminHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin
      management={{
        label: "Gestion des utilisateurs",
        shortLabel: "Utilisateurs",
        icon: "manage_accounts",
        panel: (
          <section className="min-w-0 space-y-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md">
            <div className="mb-sm flex flex-wrap items-center justify-between gap-sm border-b border-[#CDCDD1] pb-xs">
              <h2 className="font-headline-sm text-headline-sm text-primary">Départs</h2>
              <Link
                to="/manage/users"
                className="font-label-md text-label-md text-primary underline-offset-2 hover:underline"
              >
                OUVRIR LES UTILISATEURS AUTORISÉS
              </Link>
            </div>
            <DepartureNotices email={props.email} />
          </section>
        ),
      }}
    />
  );
}
