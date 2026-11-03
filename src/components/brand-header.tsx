import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import sharkLogo from "@/assets/bigger-boat-shark.png";
import { NotificationBell } from "@/components/home/notification-bell";
import { accountLabel, cleanFirstName, firstInitial } from "@/lib/account-pill";

/** Variable CSS portant la hauteur réelle du bandeau de l'accueil (lue par le menu latéral). */
const HEADER_HEIGHT_VAR = "--home-header-h";

/** Bandeau de l'accueil : prénom et rôle de la personne connectée. */
export type HomeBanner = {
  /** Prénom de la personne connectée ; absent ou vide : initiale « ? » et aucun prénom affiché. */
  firstName: string | null | undefined;
  roleLabel: string;
};

function AccountPill({ firstName, roleLabel }: Pick<HomeBanner, "firstName" | "roleLabel">) {
  const name = cleanFirstName(firstName);
  const label = accountLabel(name, roleLabel);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex min-h-[44px] min-w-0 items-center gap-xs px-xs"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#28282D] font-label-md text-label-md text-[#F9F8F5]"
      >
        {firstInitial(name)}
      </span>
      {name && (
        <span
          aria-hidden="true"
          className="max-w-[6rem] truncate font-label-md text-label-md text-primary sm:max-w-[10rem]"
        >
          {name}
        </span>
      )}
    </span>
  );
}

/**
 * `email` et `onOpenNotifications` : renseignés sur l'accueil pour afficher la cloche des notifications
 * (elle reste visible et ouvre la section Notifications du menu).
 * `home` : propre à l'accueil. Le bandeau occupe toute la largeur de la fenêtre (même marge de 6 px que
 * le rail, à gauche comme à droite), reste visible au défilement, porte la cloche et la pilule du
 * prénom (la déconnexion est dans le rail), et publie sa hauteur dans `--home-header-h` pour caler
 * le menu latéral.
 */
export function BrandHeader({
  email,
  onOpenNotifications,
  home,
}: {
  email?: string;
  onOpenNotifications?: () => void;
  home?: HomeBanner;
}) {
  const ref = useRef<HTMLElement>(null);
  const isHome = !!home;

  useEffect(() => {
    const el = ref.current;
    if (!isHome || !el) return;
    const root = document.documentElement;
    const apply = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty(HEADER_HEIGHT_VAR, `${height}px`);
      // Ancres et focus ne passent jamais sous le bandeau.
      root.style.scrollPaddingTop = `${height + 8}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(HEADER_HEIGHT_VAR);
      root.style.removeProperty("scroll-padding-top");
    };
  }, [isHome]);

  return (
    <header
      ref={ref}
      className={`border-b border-outline-variant bg-surface-container-lowest ${
        isHome ? "sticky top-0 z-40" : ""
      }`}
    >
      <div
        className={`flex min-h-16 w-full items-center justify-between py-xs ${
          isHome
            ? "min-w-0 flex-wrap gap-x-md gap-y-xs pl-[6px] pr-[6px]"
            : "mx-auto max-w-interface gap-md px-sm md:px-md"
        }`}
      >
        <Link
          to="/"
          className="flex min-w-0 items-center gap-sm"
          aria-label="Bigger Boat — accueil"
        >
          <img
            src={sharkLogo}
            alt=""
            width={1024}
            height={1024}
            className="h-11 w-14 shrink-0 object-contain"
          />
          <span className="font-label-md text-lg text-primary">
            <span className="font-bold uppercase">Bigger Boat</span>
            {isHome && <span className="font-normal normal-case"> - Happy Place</span>}
          </span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-xs">
          {!home && (
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Happy Place
            </span>
          )}
          {email && onOpenNotifications && (
            <NotificationBell email={email} onOpen={onOpenNotifications} />
          )}
          {home && <AccountPill firstName={home.firstName} roleLabel={home.roleLabel} />}
        </div>
      </div>
    </header>
  );
}
