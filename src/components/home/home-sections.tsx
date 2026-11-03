import { useState, type ReactNode } from "react";
import { OVERVIEW_ID } from "@/lib/side-nav";
import { SideNavLayout } from "./side-nav-layout";
import type { SideNavItem } from "./side-nav";

export type HomeSection = SideNavItem & {
  panel: ReactNode;
  /** Affiché à droite du titre quand la section est active. */
  titleAside?: ReactNode;
};

/**
 * Accueil à menu latéral. L'état de la section active vit ici, et nulle part ailleurs. Tous les
 * panneaux restent montés, seul l'actif est visible : leur état (formulaires, filtres) est conservé.
 */
export function HomeSections({
  sections,
  defaultId = OVERVIEW_ID,
}: {
  sections: HomeSection[];
  defaultId?: string;
}) {
  const [active, setActive] = useState(defaultId);
  const items: SideNavItem[] = sections.map(
    ({ panel: _panel, titleAside: _aside, ...item }) => item,
  );
  const titleAside = sections.find((s) => s.id === active)?.titleAside;

  return (
    <SideNavLayout items={items} activeId={active} onChange={setActive} titleAside={titleAside}>
      {sections.map((s) => (
        <div key={s.id} id={`section-${s.id}`} hidden={active !== s.id} className="space-y-xs">
          {s.panel}
        </div>
      ))}
    </SideNavLayout>
  );
}
