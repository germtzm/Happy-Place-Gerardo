import { HomeTile, StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function ManagerHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin={false}
      managementTile={
        <HomeTile title="Gestion du personnel">
          <p className="text-body-sm text-on-surface-variant italic">Bientôt disponible.</p>
        </HomeTile>
      }
    />
  );
}
