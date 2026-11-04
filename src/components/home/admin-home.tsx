import { DepartureNotices } from "@/components/departure-notices";
import { TeamsAdminPanel } from "@/components/manage/teams-admin";
import { UsersAdminPanel } from "@/components/manage/users-admin";
import type { HomeSection } from "./home-sections";
import { StaffHome } from "./staff-home";
import type { HomeProps } from "./types";

export function AdminHome(props: HomeProps) {
  // Groupe sans panneau ni compteur : ses deux sous-entrées reprennent les sections de /manage/users.
  const extraSections: HomeSection[] = [
    {
      id: "groupe-utilisateurs",
      label: "Utilisateurs",
      icon: "manage_accounts",
      children: [
        {
          id: "equipes-admin",
          label: "Gestion d'équipes",
          title: "Gestion d'équipes",
          icon: "groups",
          panel: <TeamsAdminPanel />,
        },
        {
          id: "utilisateurs-admin",
          label: "Gestion d'utilisateurs",
          title: "Gestion d'utilisateurs",
          icon: "person_add",
          panel: <UsersAdminPanel me={props.email} />,
        },
      ],
    },
  ];

  return (
    <StaffHome
      {...props}
      isAdmin
      extraSections={extraSections}
      management={{
        label: "Départs",
        // La carte porte déjà le titre « Départs » : le titre de section reste lu mais n'est pas affiché.
        hideTitle: true,
        shortLabel: "Départs",
        icon: "event_busy",
        panel: (
          <section className="min-w-0 space-y-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md">
            <div className="mb-sm flex flex-wrap items-center justify-between gap-sm border-b border-[#CDCDD1] pb-xs">
              <h2 className="font-headline-sm text-headline-sm text-primary">Départs</h2>
            </div>
            <DepartureNotices email={props.email} />
          </section>
        ),
      }}
    />
  );
}
