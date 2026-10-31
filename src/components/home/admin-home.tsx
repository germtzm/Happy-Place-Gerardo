import { Link } from "@tanstack/react-router";
import { HomeTile, StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function AdminHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin
      managementTile={
        <HomeTile title="Gestion des utilisateurs">
          <Link
            to="/manage/users"
            className="font-label-md text-label-md text-primary underline-offset-2 hover:underline"
          >
            OUVRIR LES UTILISATEURS AUTORISÉS
          </Link>
        </HomeTile>
      }
    />
  );
}
