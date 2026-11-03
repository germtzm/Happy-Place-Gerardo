import { useEffect, useId, useRef, type ReactNode } from "react";
import { SideNav, type SideNavItem } from "./side-nav";

/**
 * Page à menu latéral : le menu à gauche (au-dessus du contenu en dessous de md), la section active à
 * droite sous son titre. Un lien d'évitement mène au titre ; à chaque changement de section, le focus
 * va au titre (tabIndex -1). Pas de focus au premier affichage.
 *
 * Exemple (la section active est un état React, pas une URL) :
 *
 *   const [active, setActive] = useState("demandes");
 *   <SideNavLayout
 *     items={[
 *       { id: "demandes", label: "Demandes", icon: "inbox", count: 3, ariaLabel: "Demandes, 3 à traiter" },
 *       { id: "actualites", label: "Actualités", title: "Actualités du cabinet", icon: "newspaper" },
 *     ]}
 *     bottomItems={[{ id: "notifications", label: "Notifications", icon: "notifications" }]}
 *     activeId={active}
 *     onChange={setActive}
 *   >
 *     {active === "demandes" ? <Demandes /> : <Actualites />}
 *   </SideNavLayout>
 */
export function SideNavLayout({
  items,
  bottomItems = [],
  activeId,
  onChange,
  titleAside,
  children,
}: {
  items: SideNavItem[];
  bottomItems?: SideNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Élément facultatif à droite du titre de la section active (par exemple un compteur). */
  titleAside?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownId = useRef(activeId);

  useEffect(() => {
    if (shownId.current === activeId) return;
    shownId.current = activeId;
    titleRef.current?.focus();
  }, [activeId]);

  const active = [...items, ...bottomItems].find((i) => i.id === activeId);
  const title = active?.title ?? active?.label ?? "";

  return (
    <div className="relative flex flex-col md:flex-row md:items-stretch md:gap-md">
      <a
        href="#contenu-principal"
        onClick={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-xs focus:top-xs focus:z-50 focus:rounded-[8px] focus:bg-[#28282D] focus:px-md focus:py-xs focus:font-label-md focus:text-label-md focus:text-[#F9F8F5] focus:outline-none focus:ring-2 focus:ring-[#28282D] focus:ring-offset-2"
      >
        Aller au contenu
      </a>
      <SideNav items={items} bottomItems={bottomItems} activeId={activeId} onChange={onChange} />
      <section
        id="contenu-principal"
        aria-labelledby={titleId}
        className="min-w-0 flex-1 space-y-md pt-md md:pt-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h2
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="font-headline-sm text-headline-sm text-primary focus:outline-none"
          >
            {title}
          </h2>
          {titleAside}
        </div>
        {children}
      </section>
    </div>
  );
}
