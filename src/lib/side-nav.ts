/** Identifiant de l'entrée « Vue d'ensemble » (les trois cartes du haut), active à l'ouverture. */
export const OVERVIEW_ID = "vue-ensemble";

/** Entrées du groupe du bas du rail. */
export const NOTIFICATIONS_ID = "notifications";
export const RECAP_ID = "recapitulatif";

/** Pluriel simple pour les noms accessibles des compteurs. */
export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
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
