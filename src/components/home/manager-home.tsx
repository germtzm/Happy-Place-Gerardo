import { DepartureNotices } from "@/components/departure-notices";
import { StaffHome } from "./staff-home";
import { SECTION_CLS, TITLE_CLS, TeamDeparturesList } from "./team-departures-list";
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
          <div className="space-y-md">
            <section className={SECTION_CLS}>
              <h2 className={TITLE_CLS}>Départs de mes équipes</h2>
              <DepartureNotices email={props.email} />
            </section>
            <TeamDeparturesList title="Départs dans mes équipes" />
          </div>
        ),
      }}
    />
  );
}
