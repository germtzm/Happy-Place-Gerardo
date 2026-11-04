import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { menuButtonLabel, menuEntries } from "@/lib/mobile-menu";
import {
  ancestorGroupIds,
  flattenNavItems,
  groupKeyAction,
  isNavGroup,
  nextNavIndex,
  visibleNavIds,
} from "@/lib/side-nav";
import { Icon } from "./icon";

export type SideNavItem = {
  id: string;
  /** Libellé affiché à côté de l'icône (retour à la ligne autorisé, jamais de troncature). */
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
  /**
   * Titre de section lu mais non affiché (classe `sr-only`) : à utiliser quand la carte de la section
   * porte déjà le même titre. Le h1 reste dans le DOM (cible du focus au changement d'entrée).
   */
  hideTitle?: boolean;
  /**
   * Entrée d'action : le clic lance cette fonction au lieu d'ouvrir une section. Elle n'est jamais la
   * section active (pas d'`aria-current`), ne reçoit pas le focus à titre de section, mais reste dans
   * la navigation aux flèches.
   */
  onSelect?: () => void;
  /**
   * Mise en avant d'une entrée d'action : `soft` = fond clair avec bordure, `dark` = fond foncé, texte et
   * icône clairs. Sans effet sur les sections et les groupes.
   */
  emphasis?: "soft" | "dark";
  /**
   * Sous-entrées : l'élément est alors un groupe dépliable. Un groupe n'est jamais la section active,
   * n'a ni `onSelect` ni titre de section ; ses enfants sont des entrées normales (sections ou actions).
   */
  children?: SideNavItem[];
};

type Props = {
  items: SideNavItem[];
  /** Groupe placé en bas du rail : sections (Notifications, Récapitulatif) puis entrées d'action. */
  bottomItems?: SideNavItem[];
  activeId: string;
  onChange: (id: string) => void;
};

/** État des groupes dépliés, partagé entre le rail et le menu replié (état React local, jamais stocké). */
type Shared = {
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSetOpen: (id: string, open: boolean) => void;
  idPrefix: string;
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

/**
 * Contrastes (WCAG, texte normal 4,5 pour 1) : #28282D sur #EEEDEA 12,5 ; #28282D sur #F5F4F1 13,3 ;
 * #55555A sur blanc 7,4, sur #F5F4F1 6,7 et sur #EEEDEA 6,3. L'anneau de focus #28282D est un indicateur
 * de 2 px, sans texte.
 */
function rowCls(active: boolean, bold = false, emphasis?: SideNavItem["emphasis"]): string {
  if (emphasis) {
    // Entrées d'action mises en avant : anneau de focus extérieur de 2 px (#28282D sur blanc, 14 pour 1),
    // séparé du fond de l'entrée par 2 px de blanc, car un anneau intérieur #28282D disparaîtrait sur le
    // fond foncé. Contrastes : #28282D sur #EEEDEA 12,5 ; #F9F8F5 sur #28282D 14 ; #F9F8F5 sur #3A3A40 11.
    const look =
      emphasis === "dark"
        ? "bg-[#28282D] text-[#F9F8F5] hover:bg-[#3A3A40]"
        : "border border-[#CDCDD1] bg-[#EEEDEA] text-[#28282D] hover:bg-[#E3E2DE]";
    return `flex min-h-[44px] w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[6px] text-left font-label-md text-label-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28282D] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${look}`;
  }
  const state = active
    ? "bg-[#EEEDEA] font-bold text-[#28282D]"
    : `text-[#55555A] hover:bg-[#F5F4F1] hover:text-[#28282D] ${bold ? "font-bold" : ""}`;
  return `flex min-h-[44px] w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[6px] text-left font-label-md text-label-md focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#28282D] ${state}`;
}

const separatorCls = "my-[2px] h-px w-full bg-[#CDCDD1]";

type RowCtx = Shared & {
  activeId: string;
  onPick: (item: SideNavItem) => void;
  setRef?: (id: string, el: HTMLButtonElement | null) => void;
};

type NodeProps = { item: SideNavItem; ctx: RowCtx; child?: boolean };

function NavLeaf({ item, ctx, child = false }: NodeProps) {
  const active = !item.onSelect && item.id === ctx.activeId;
  return (
    <li>
      <button
        type="button"
        ref={(el) => ctx.setRef?.(item.id, el)}
        aria-current={active ? "page" : undefined}
        aria-label={item.ariaLabel}
        onClick={() => ctx.onPick(item)}
        className={rowCls(active, false, item.onSelect ? item.emphasis : undefined)}
      >
        {item.icon && <Icon name={item.icon} size={child ? 18 : 20} className="shrink-0" />}
        <span className="min-w-0 flex-1 wrap-anywhere">{item.label}</span>
        {hasCount(item) && <CountBadge item={item} className="shrink-0 whitespace-nowrap" />}
      </button>
    </li>
  );
}

/**
 * Groupe : une ligne bouton (icône, libellé, chevron) et la liste de ses enfants, décalée de 18 px, avec un
 * trait vertical de 1 px à gauche sur toute la hauteur et 6 px de retrait entre le trait et les lignes.
 * Fermé, le groupe est `hidden` : ses enfants sont hors de la tabulation.
 */
function NavGroup({ item, ctx, child = false }: NodeProps) {
  const open = ctx.expanded.has(item.id);
  const children = item.children ?? [];
  const listId = `${ctx.idPrefix}-${item.id}`;
  const holdsActive =
    !open && flattenNavItems(children).some((c) => !c.onSelect && c.id === ctx.activeId);
  return (
    <li>
      <button
        type="button"
        ref={(el) => ctx.setRef?.(item.id, el)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={item.ariaLabel}
        onClick={() => ctx.onToggle(item.id)}
        className={rowCls(false, holdsActive)}
      >
        {item.icon && <Icon name={item.icon} size={child ? 18 : 20} className="shrink-0" />}
        <span className="min-w-0 flex-1 wrap-anywhere">{item.label}</span>
        {hasCount(item) && <CountBadge item={item} className="shrink-0 whitespace-nowrap" />}
        <Icon name={open ? "expand_less" : "expand_more"} size={20} className="shrink-0" />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="ml-[18px] mt-[2px] space-y-[2px] border-l border-[#CDCDD1] pl-[6px]"
      >
        {children.map((c) => (
          <NavNode key={c.id} item={c} ctx={ctx} child />
        ))}
      </ul>
    </li>
  );
}

function NavNode({ item, ctx, child = false }: NodeProps) {
  return isNavGroup(item) ? (
    <NavGroup item={item} ctx={ctx} child={child} />
  ) : (
    <NavLeaf item={item} ctx={ctx} child={child} />
  );
}

/**
 * Sous lg : bouton « Menu : section active » pleine largeur, qui déroule le même menu en liste verticale
 * (mêmes lignes, mêmes groupes dépliables et mêmes traits que le rail). Ce n'est pas une fenêtre modale :
 * pas de piège de focus. Replié, le bloc est `hidden` (hors de la tabulation) ; Échap le referme et rend le
 * focus au bouton ; choisir une entrée le referme (pour une section, le focus va ensuite au titre, voir
 * SideNavLayout). Déplier un groupe ne referme pas le menu.
 */
function MobileMenu({
  items,
  bottomItems = [],
  activeId,
  onChange,
  expanded,
  onToggle,
  onSetOpen,
  idPrefix,
}: Props & Shared) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const active = flattenNavItems([...items, ...bottomItems]).find(
    (i) => i.id === activeId && !i.onSelect && !isNavGroup(i),
  );

  // Un changement de section venu d'ailleurs (la cloche du bandeau) referme le menu.
  useEffect(() => {
    setOpen(false);
  }, [activeId]);

  function choose(item: SideNavItem) {
    setOpen(false);
    if (item.onSelect) {
      item.onSelect();
      button.current?.focus();
    } else {
      onChange(item.id);
      // Même section : rien ne déplace le focus vers le titre, le bouton le garde.
      if (item.id === activeId) button.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Escape" || !open) return;
    e.preventDefault();
    setOpen(false);
    button.current?.focus();
  }

  const ctx: RowCtx = { activeId, expanded, onToggle, onSetOpen, idPrefix, onPick: choose };

  return (
    <nav
      aria-label="Sections de l'accueil"
      onKeyDown={onKeyDown}
      className="border-b border-[#CDCDD1] bg-white lg:hidden"
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center gap-sm px-sm py-xs text-left font-label-md text-label-md text-[#28282D] hover:bg-[#EEEDEA] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#28282D]"
      >
        <Icon name="menu" className="shrink-0" />
        <span className="min-w-0 flex-1 wrap-anywhere">{menuButtonLabel(active?.label)}</span>
        <Icon name={open ? "expand_less" : "expand_more"} className="shrink-0" />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-[#CDCDD1]">
        <ul className="space-y-[2px] px-[8px] py-[8px]">
          {menuEntries(items, bottomItems).map((entry) => {
            if (entry.type === "separator") {
              return <li key={entry.key} aria-hidden="true" className={separatorCls} />;
            }
            // Les sous-entrées sont rendues par leur groupe, avec le trait vertical.
            if (entry.parentId !== undefined) return null;
            return <NavNode key={entry.item.id} item={entry.item} ctx={ctx} />;
          })}
        </ul>
      </div>
    </nav>
  );
}

/**
 * Menu latéral façon Cloudflare : rail de 232 px collé au bord gauche à partir de lg, entrées en pleine
 * largeur (icône et libellé complet), groupes dépliables dont les sous-entrées sont précédées d'un trait
 * vertical ; au-dessous de lg, un bouton « Menu » déroule la liste (voir MobileMenu). Dans le rail, le
 * groupe du haut défile, le groupe du bas reste épinglé. Chaque entrée est un bouton, une tabulation
 * chacune ; les flèches haut et bas, Début et Fin déplacent le focus entre les entrées visibles sans
 * activer ; Entrée ou Espace plie ou déplie un groupe ; flèche droite le déplie, flèche gauche le replie
 * (depuis un enfant, elle ramène le focus sur son groupe).
 */
export function SideNav(props: Props) {
  const idPrefix = useId();
  const all = [...props.items, ...(props.bottomItems ?? [])];
  const activeGroups = ancestorGroupIds(all, props.activeId);
  const activeGroupKey = activeGroups.join("\n");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroups));

  // Le groupe de l'entrée active se déplie quand elle change (par exemple depuis la cloche).
  useEffect(() => {
    if (!activeGroupKey) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      activeGroupKey.split("\n").forEach((id) => next.add(id));
      return next;
    });
  }, [activeGroupKey, props.activeId]);

  function onSetOpen(id: string, open: boolean) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onToggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <MobileMenu
        {...props}
        expanded={expanded}
        onToggle={onToggle}
        onSetOpen={onSetOpen}
        idPrefix={`${idPrefix}-m`}
      />
      <Rail
        {...props}
        expanded={expanded}
        onToggle={onToggle}
        onSetOpen={onSetOpen}
        idPrefix={`${idPrefix}-r`}
      />
    </>
  );
}

function Rail({
  items,
  bottomItems = [],
  activeId,
  onChange,
  expanded,
  onToggle,
  onSetOpen,
  idPrefix,
}: Props & Shared) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const all = [...items, ...bottomItems];
  const visible = visibleNavIds(all, expanded);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const current = visible.findIndex((id) => refs.current[id] === document.activeElement);
    const next = nextNavIndex(visible.length, current, e.key);
    if (next !== null) {
      e.preventDefault();
      refs.current[visible[next]]?.focus();
      return;
    }
    if (current < 0) return;
    const id = visible[current];
    const entry = flattenNavItems(all).find((i) => i.id === id);
    const parents = ancestorGroupIds(all, id);
    const parentId = parents[parents.length - 1];
    const action = groupKeyAction(e.key, {
      isGroup: !!entry && isNavGroup(entry),
      expanded: expanded.has(id),
      hasParent: parentId !== undefined,
    });
    if (action === null) return;
    e.preventDefault();
    if (action === "expand") onSetOpen(id, true);
    else if (action === "collapse") onSetOpen(id, false);
    else if (parentId !== undefined) refs.current[parentId]?.focus();
  }

  const ctx: RowCtx = {
    activeId,
    expanded,
    onToggle,
    onSetOpen,
    idPrefix,
    onPick: (item) => (item.onSelect ? item.onSelect() : onChange(item.id)),
    setRef: (id, el) => {
      refs.current[id] = el;
    },
  };

  return (
    <nav
      aria-label="Sections de l'accueil"
      onKeyDown={onKeyDown}
      className="hidden shrink-0 border-[#CDCDD1] bg-white lg:sticky lg:top-[var(--home-header-h,4rem)] lg:flex lg:h-[calc(100dvh-var(--home-header-h,4rem))] lg:w-[232px] lg:flex-col lg:self-start lg:overflow-hidden lg:border-r"
    >
      <ul className="min-h-0 flex-1 space-y-[2px] overflow-y-auto overflow-x-hidden px-[8px] py-[8px]">
        {items.flatMap((item, i) =>
          i === 0 && items.length > 1
            ? [
                <NavNode key={item.id} item={item} ctx={ctx} />,
                <li key="sep-first" aria-hidden="true" className={separatorCls} />,
              ]
            : [<NavNode key={item.id} item={item} ctx={ctx} />],
        )}
      </ul>
      {bottomItems.length > 0 && (
        <>
          <div aria-hidden="true" className={`${separatorCls} shrink-0`} />
          <ul className="shrink-0 space-y-[2px] px-[8px] py-[8px]">
            {bottomItems.flatMap((item, i) =>
              item.onSelect && i > 0 && !bottomItems[i - 1].onSelect
                ? [
                    <li key={`sep-${item.id}`} aria-hidden="true" className={separatorCls} />,
                    <NavNode key={item.id} item={item} ctx={ctx} />,
                  ]
                : [<NavNode key={item.id} item={item} ctx={ctx} />],
            )}
          </ul>
        </>
      )}
    </nav>
  );
}
