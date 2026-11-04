import { useEffect, useId, useRef, type ReactNode } from "react";
import { breadcrumbTrail, flattenNavItems } from "@/lib/side-nav";
import { SideNav, type SideNavItem } from "./side-nav";

/**
 * Élément facultatif à droite du titre de la section active (compteur, boutons). Une fonction reçoit
 * de quoi redonner le focus au titre (par exemple quand un bouton disparaît après son action).
 */
export type TitleAside = ReactNode | ((focusTitle: () => void) => ReactNode);

/**
 * Page à menu latéral : le menu large (232 px) collé au bord gauche de la fenêtre à partir de lg (sous lg,
 * un bouton « Menu » au-dessus du contenu déroule la liste), la section active à droite sous son titre, à
 * largeur maximale centrée dans l'espace restant. Une entrée peut être un groupe dépliable (`children`),
 * jamais la section active. Le
 * composant doit être posé hors d'un conteneur centré, sinon le rail ne touche pas le bord. Un lien
 * d'évitement mène au titre ; à chaque changement de section, le focus va au titre (tabIndex -1).
 * Pas de focus au premier affichage.
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
  titleAside?: TitleAside;
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

  const active = flattenNavItems([...items, ...bottomItems]).find((i) => i.id === activeId);
  const title = active?.title ?? active?.label ?? "";
  const hideTitle = !!active?.hideTitle;
  const trail = breadcrumbTrail([...items, ...bottomItems], activeId);
  const hasAside = titleAside !== undefined && titleAside !== null && titleAside !== false;
  const heading = (
    <h1
      id={titleId}
      ref={titleRef}
      tabIndex={-1}
      className={`scroll-mt-[var(--home-header-h,4rem)] font-headline-sm text-headline-sm text-primary focus:outline-none ${
        hideTitle ? "sr-only" : ""
      }`}
    >
      {title}
    </h1>
  );

  return (
    <div className="relative flex flex-col lg:flex-row lg:items-stretch">
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
        className="mx-auto w-full min-w-0 max-w-interface flex-1 space-y-md px-sm py-md lg:p-md"
      >
        {trail.length > 0 && (
          <nav aria-label="Fil d'Ariane">
            <ol className="flex flex-wrap items-center gap-x-xs gap-y-0 font-label-md text-label-md text-[#55555A]">
              {trail.map((crumb, i) => {
                const last = i === trail.length - 1;
                return (
                  <li key={crumb.id} className="flex items-center gap-xs">
                    {last ? (
                      <span aria-current="page" className="font-bold text-[#28282D]">
                        {crumb.label}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onChange(crumb.targetId)}
                          className="min-h-[24px] underline hover:text-[#28282D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28282D]"
                        >
                          {crumb.label}
                        </button>
                        <span aria-hidden="true">&gt;</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {hideTitle && !hasAside ? (
          // Titre invisible et rien à droite : pas de rangée, donc aucun espace vertical vide.
          heading
        ) : (
          // Titre masqué : la rangée ne contient que l'élément de droite, aligné à droite.
          <div
            className={`flex flex-wrap items-center gap-sm ${
              hideTitle ? "justify-end" : "justify-between"
            }`}
          >
            {heading}
            {typeof titleAside === "function"
              ? titleAside(() => titleRef.current?.focus())
              : titleAside}
          </div>
        )}
        {children}
      </section>
    </div>
  );
}
