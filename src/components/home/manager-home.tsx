import { DepartureNotices } from "@/components/departure-notices";
import { StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function ManagerHome(props: HomeProps) {
  return (
    <StaffHome
      {...props}
      isAdmin={false}
      management={{
        label: "Gestion du personnel",
        shortLabel: "Personnel",
        icon: "badge",
        panel: (
          <section className="min-w-0 space-y-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md">
            <h2 className="mb-sm border-b border-[#CDCDD1] pb-xs font-headline-sm text-headline-sm text-primary">
              Départs de mes équipes
            </h2>
            <DepartureNotices email={props.email} />
          </section>
        ),
      }}
    />
  );
}
