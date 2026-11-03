import { useContext, type ReactNode } from "react";
import { HomeContext } from "./home-context";
import { SideNavLayout, type TitleAside } from "./side-nav-layout";
import type { SideNavItem } from "./side-nav";

export type HomeSection = SideNavItem & {
  panel: ReactNode;
  /** Affiché à droite du titre quand la section est active. */
  titleAside?: TitleAside;
};

function toItem({ panel: _panel, titleAside: _aside, ...item }: HomeSection): SideNavItem {
  return item;
}

/**
 * Accueil à menu latéral. La section active vient de HomeContext (un seul état, dans la page). Tous les
 * panneaux restent montés, seul l'actif est visible : leur état (formulaires, filtres) est conservé.
 * `bottomSections` forme le groupe du bas du rail (Notifications, Récapitulatif).
 */
export function HomeSections({
  sections,
  bottomSections = [],
}: {
  sections: HomeSection[];
  bottomSections?: HomeSection[];
}) {
  const { activeId, onChange } = useContext(HomeContext);
  const all = [...sections, ...bottomSections];
  const titleAside = all.find((s) => s.id === activeId)?.titleAside;

  return (
    <SideNavLayout
      items={sections.map(toItem)}
      bottomItems={bottomSections.map(toItem)}
      activeId={activeId}
      onChange={onChange}
      titleAside={titleAside}
    >
      {all.map((s) => (
        <div key={s.id} id={`section-${s.id}`} hidden={activeId !== s.id} className="space-y-xs">
          {s.panel}
        </div>
      ))}
    </SideNavLayout>
  );
}
