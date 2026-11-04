/** Identifiant de l'entrée « Vue d'ensemble » (les trois cartes du haut), active à l'ouverture. */
export const OVERVIEW_ID = "vue-ensemble";

/** Entrées du groupe du bas du rail. */
export const NOTIFICATIONS_ID = "notifications";
export const RECAP_ID = "recapitulatif";

/** Pluriel simple pour les noms accessibles des compteurs. */
export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}

/** Un élément qui a un champ `children` est un groupe : jamais la section active, il se plie et se déplie. */
export function isNavGroup(item: { children?: unknown }): boolean {
  return item.children !== undefined;
}

/** Tous les éléments à plat, chaque groupe suivi de ses enfants (dans l'ordre de lecture). */
export function flattenNavItems<T extends { id: string; children?: T[] }>(items: T[]): T[] {
  return items.flatMap((item) => [item, ...flattenNavItems(item.children ?? [])]);
}

function pathTo<T extends { id: string; children?: T[] }>(
  items: T[],
  id: string,
  trail: string[],
): string[] | null {
  for (const item of items) {
    if (item.id === id) return trail;
    const found = item.children ? pathTo(item.children, id, [...trail, item.id]) : null;
    if (found !== null) return found;
  }
  return null;
}

/** Identifiants des groupes qui contiennent l'élément `id`, du plus haut au plus proche ; vide s'il est à la racine ou absent. */
export function ancestorGroupIds<T extends { id: string; children?: T[] }>(
  items: T[],
  id: string,
): string[] {
  return pathTo(items, id, []) ?? [];
}

/**
 * Identifiants des entrées visibles, dans l'ordre : un groupe, puis ses enfants seulement s'il est déplié.
 * C'est la liste que parcourent les flèches du clavier.
 */
export function visibleNavIds<T extends { id: string; children?: T[] }>(
  items: T[],
  expanded: ReadonlySet<string>,
): string[] {
  return items.flatMap((item) => [
    item.id,
    ...(item.children && expanded.has(item.id) ? visibleNavIds(item.children, expanded) : []),
  ]);
}

export type GroupKeyAction = "expand" | "collapse" | "focus-parent" | null;

/**
 * Flèches droite et gauche : droite déplie un groupe fermé ; gauche replie un groupe déplié, ou, depuis
 * un enfant, ramène le focus sur son groupe. Entrée et Espace passent par le clic du bouton.
 */
export function groupKeyAction(
  key: string,
  ctx: { isGroup: boolean; expanded: boolean; hasParent: boolean },
): GroupKeyAction {
  if (key === "ArrowRight") return ctx.isGroup && !ctx.expanded ? "expand" : null;
  if (key === "ArrowLeft") {
    if (ctx.isGroup && ctx.expanded) return "collapse";
    return ctx.hasParent ? "focus-parent" : null;
  }
  return null;
}

/**
 * Entrée vers laquelle déplacer le focus dans le menu latéral, selon la touche pressée.
 * `current` vaut -1 si aucune entrée n'a le focus. Retourne null pour une touche non gérée.
 * Les flèches bouclent ; Début et Fin vont à la première et à la dernière entrée.
 */
export function nextNavIndex(count: number, current: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
