import { Link } from "@tanstack/react-router";
import { StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function AdminHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin
      management={{
        label: "Gestion des utilisateurs",
        panel: (
          <section className="min-w-0 rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md">
            <Link
              to="/manage/users"
              className="font-label-md text-label-md text-primary underline-offset-2 hover:underline"
            >
              OUVRIR LES UTILISATEURS AUTORISÉS
            </Link>
          </section>
        ),
      }}
    />
  );
}
