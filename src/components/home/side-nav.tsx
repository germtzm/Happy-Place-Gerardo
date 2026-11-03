import { useRef, type KeyboardEvent } from "react";
import { nextNavIndex } from "@/lib/side-nav";
import { Icon } from "./icon";

export type SideNavItem = {
  id: string;
  /** Libellé court affiché sous l'icône (deux lignes au plus). */
  label: string;
  /** Nom accessible complet, par exemple « Demandes, 3 à traiter » ; à défaut, `label`. */
  ariaLabel?: string;
  /** Nom d'icône Material Symbols. */
  icon?: string;
  /** Compteur en pastille ; affiché dès qu'il est fourni, sauf 0 (le nom accessible le dit alors). */
  count?: number | string;
  /** Compteur urgent : pastille rouge pâle et « ! » décoratif ; le nom accessible porte l'information. */
  urgent?: boolean;
  /** Titre de la section quand il diffère du libellé court (utilisé par SideNavLayout). */
  title?: string;
};

type Props = {
  items: SideNavItem[];
  /** Groupe placé en bas du rail (Notifications, Récapitulatif). */
  bottomItems?: SideNavItem[];
  activeId: string;
  onChange: (id: string) => void;
};

/** Pastille affichée pour tout compteur fourni, sauf 0. */
function hasCount(item: SideNavItem): boolean {
  return item.count !== undefined && item.count !== 0;
}

function CountBadge({ item, className = "" }: { item: SideNavItem; className?: string }) {
  const tone = item.urgent ? "bg-[#FED2CE] text-[#72020E]" : "bg-[#F0D0BC] text-[#482A1D]";
  return (
    <span
      className={`min-w-[18px] rounded-full px-[4px] text-center font-label-sm text-[11px] leading-[18px] ${tone} ${className}`}
    >
      {item.count}
      {item.urgent && <span aria-hidden="true"> !</span>}
    </span>
  );
}

const separatorCls = "h-auto w-px self-stretch bg-[#CDCDD1] md:h-px md:w-full md:self-auto";

/**
 * Menu latéral : rail de 88 px à gauche à partir de md (au-dessous, les entrées passent à la ligne
 * au-dessus du contenu). Chaque entrée est un bouton, une tabulation chacune ; les flèches haut et
 * bas, Début et Fin déplacent le focus sans activer.
 */
export function SideNav({ items, bottomItems = [], activeId, onChange }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ids = [...items, ...bottomItems].map((i) => i.id);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const current = ids.findIndex((id) => refs.current[id] === document.activeElement);
    const next = nextNavIndex(ids.length, current, e.key);
    if (next === null) return;
    e.preventDefault();
    refs.current[ids[next]]?.focus();
  }

  function renderItem(item: SideNavItem) {
    const active = item.id === activeId;
    return (
      <li key={item.id} className="w-[76px] md:w-full">
        <button
          type="button"
          ref={(el) => {
            refs.current[item.id] = el;
          }}
          aria-current={active ? "page" : undefined}
          aria-label={item.ariaLabel}
          onClick={() => onChange(item.id)}
          className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-[2px] rounded-[8px] px-[2px] py-xs text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28282D] focus-visible:ring-offset-2 ${
            active ? "bg-[#28282D] text-[#F9F8F5]" : "text-[#55555A] hover:bg-[#EEEDEA]"
          }`}
        >
          {item.icon && (
            <span className="relative inline-flex">
              <Icon name={item.icon} />
              {hasCount(item) && (
                <CountBadge
                  item={item}
                  className="absolute -top-[6px] left-full -translate-x-[6px] whitespace-nowrap"
                />
              )}
            </span>
          )}
          {!item.icon && hasCount(item) && <CountBadge item={item} />}
          <span className="line-clamp-2 font-label-md text-[12px] leading-[1.2] tracking-normal wrap-anywhere">
            {item.label}
          </span>
        </button>
      </li>
    );
  }

  return (
    <nav
      aria-label="Sections de l'accueil"
      onKeyDown={onKeyDown}
      className="flex shrink-0 flex-row flex-wrap items-stretch border-b border-[#CDCDD1] bg-white md:sticky md:top-0 md:h-[calc(100dvh-4rem)] md:w-[88px] md:flex-col md:flex-nowrap md:self-start md:overflow-y-auto md:border-b-0 md:border-r"
    >
      <ul className="flex flex-wrap gap-[4px] p-[6px] md:flex-col md:flex-nowrap">
        {items.flatMap((item, i) =>
          i === 0 && items.length > 1
            ? [renderItem(item), <li key="sep-first" aria-hidden="true" className={separatorCls} />]
            : [renderItem(item)],
        )}
      </ul>
      {bottomItems.length > 0 && (
        <>
          <div aria-hidden="true" className={`${separatorCls} md:mt-auto`} />
          <ul className="flex flex-wrap gap-[4px] p-[6px] md:flex-col md:flex-nowrap">
            {bottomItems.map(renderItem)}
          </ul>
        </>
      )}
    </nav>
  );
}
