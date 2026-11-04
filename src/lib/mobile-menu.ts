/** Fonctions pures du menu replié de l'accueil sous lg. */

/** Libellé visible du bouton « Menu » : « Menu : Demandes », ou « Menu » sans section active. */
export function menuButtonLabel(activeLabel: string | null | undefined): string {
  const label = (activeLabel ?? "").trim();
  return label ? `Menu : ${label}` : "Menu";
}

/** `parentId` est renseigné pour une sous-entrée d'un groupe ; les entrées de premier niveau n'en ont pas. */
export type MenuEntry<T> =
  { type: "item"; item: T; parentId?: string } | { type: "separator"; key: string };

type MenuItem<T> = { id: string; onSelect?: unknown; children?: T[] };

/**
 * Entrées du menu replié, dans l'ordre du rail : sections (séparateur après la première), séparateur
 * de groupe, puis les entrées du bas (séparateur avant la première entrée d'action qui suit une section).
 * Les sous-entrées d'un groupe suivent leur groupe, dans l'ordre, avec `parentId` ; les séparateurs ne
 * concernent que le premier niveau.
 */
export function menuEntries<T extends MenuItem<T>>(items: T[], bottomItems: T[]): MenuEntry<T>[] {
  const out: MenuEntry<T>[] = [];
  const pushItem = (item: T, parentId?: string) => {
    out.push(parentId === undefined ? { type: "item", item } : { type: "item", item, parentId });
    item.children?.forEach((child) => pushItem(child, item.id));
  };
  items.forEach((item, i) => {
    pushItem(item);
    if (i === 0 && items.length > 1) out.push({ type: "separator", key: "sep-first" });
  });
  if (bottomItems.length > 0 && items.length > 0) {
    out.push({ type: "separator", key: "sep-groups" });
  }
  bottomItems.forEach((item, i) => {
    if (item.onSelect && i > 0 && !bottomItems[i - 1].onSelect) {
      out.push({ type: "separator", key: `sep-${item.id}` });
    }
    pushItem(item);
  });
  return out;
}
