/** Fonctions pures du menu replié de l'accueil sous md. */

/** Libellé visible du bouton « Menu » : « Menu : Demandes », ou « Menu » sans section active. */
export function menuButtonLabel(activeLabel: string | null | undefined): string {
  const label = (activeLabel ?? "").trim();
  return label ? `Menu : ${label}` : "Menu";
}

export type MenuEntry<T> = { type: "item"; item: T } | { type: "separator"; key: string };

/**
 * Entrées du menu replié, dans l'ordre du rail : sections (séparateur après la première), séparateur
 * de groupe, puis les entrées du bas (séparateur avant la première entrée d'action qui suit une section).
 */
export function menuEntries<T extends { id: string; onSelect?: unknown }>(
  items: T[],
  bottomItems: T[],
): MenuEntry<T>[] {
  const out: MenuEntry<T>[] = [];
  items.forEach((item, i) => {
    out.push({ type: "item", item });
    if (i === 0 && items.length > 1) out.push({ type: "separator", key: "sep-first" });
  });
  if (bottomItems.length > 0 && items.length > 0) {
    out.push({ type: "separator", key: "sep-groups" });
  }
  bottomItems.forEach((item, i) => {
    if (item.onSelect && i > 0 && !bottomItems[i - 1].onSelect) {
      out.push({ type: "separator", key: `sep-${item.id}` });
    }
    out.push({ type: "item", item });
  });
  return out;
}
