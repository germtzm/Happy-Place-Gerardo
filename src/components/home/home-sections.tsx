import { useContext, type ReactNode } from "react";
import { HomeContext } from "./home-context";
import { flattenNavItems, isNavGroup } from "@/lib/side-nav";
import { SideNavLayout, type TitleAside } from "./side-nav-layout";
import type { SideNavItem } from "./side-nav";

export type HomeSection = Omit<SideNavItem, "children"> & {
  /** Panneau de la section ; absent pour un groupe, qui n'a ni panneau ni titre. */
  panel?: ReactNode;
  /** Affiché à droite du titre quand la section est active. */
  titleAside?: TitleAside;
  /** Sous-entrées : l'élément est alors un groupe dépliable. */
  children?: HomeSection[];
};

function toItem({
  panel: _panel,
  titleAside: _aside,
  children,
  ...item
}: HomeSection): SideNavItem {
  return children ? { ...item, children: children.map(toItem) } : item;
}

/**
 * Accueil à menu latéral. La section active vient de HomeContext (un seul état, dans la page). Tous les
 * panneaux restent montés, seul l'actif est visible : leur état (formulaires, filtres) est conservé.
 * `bottomSections` forme le groupe du bas du rail (Notifications, Récapitulatif), suivi des entrées
 * d'action de HomeContext (Données, Déconnexion).
 */
export function HomeSections({
  sections,
  bottomSections = [],
}: {
  sections: HomeSection[];
  bottomSections?: HomeSection[];
}) {
  const { activeId, onChange, railActions } = useContext(HomeContext);
  // À plat : les groupes ne portent pas de panneau, leurs enfants si.
  const all = flattenNavItems([...sections, ...bottomSections]);
  const titleAside = all.find((s) => s.id === activeId)?.titleAside;

  return (
    <SideNavLayout
      items={sections.map(toItem)}
      bottomItems={[...bottomSections.map(toItem), ...railActions]}
      activeId={activeId}
      onChange={onChange}
      titleAside={titleAside}
    >
      {all
        .filter((s) => !isNavGroup(s))
        .map((s) => (
          <div key={s.id} id={`section-${s.id}`} hidden={activeId !== s.id} className="space-y-xs">
            {s.panel}
          </div>
        ))}
    </SideNavLayout>
  );
}
