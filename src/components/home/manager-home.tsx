import { StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function ManagerHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin={false}
      management={{
        label: "Gestion du personnel",
        panel: (
          <section className="min-w-0 rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md">
            <p className="text-body-sm text-on-surface-variant italic">Bientôt disponible.</p>
          </section>
        ),
      }}
    />
  );
}
