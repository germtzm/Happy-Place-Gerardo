/**
 * Calculs purs du défilement automatique de la Vue d'ensemble (aucun accès au DOM ni à React), pour
 * pouvoir les tester : durées d'affichage, découpage en pages, épinglage des points critiques, boucle.
 */

/** Durée d'affichage minimale d'une page d'actualités. */
export const PAGE_MIN_MS = 8000;
/** Part fixe de la durée d'une page d'actualités, avant le temps de lecture. */
export const PAGE_BASE_MS = 4000;
/** Temps de lecture ajouté par mot visible. */
export const PAGE_PER_WORD_MS = 250;
/** Délai entre deux décalages des points bloquants. */
export const BLOCKER_STEP_MS = 10000;
/** Vitesse du défilement continu des indicateurs. */
export const MARQUEE_PX_PER_SECOND = 30;
/** Nombre d'actualités par page. */
export const NEWS_PAGE_SIZE = 2;
/** Nombre de points bloquants visibles à la fois (grille de 2 colonnes sur 2 lignes). */
export const BLOCKERS_PAGE_SIZE = 4;
/** Plafond de points critiques épinglés dans la colonne de gauche. */
export const PINNED_CRITICAL_MAX = 2;
/** Au-delà de ce total de points, la zone défile ; en dessous (inclus), rien ne bouge. */
export const BLOCKERS_STATIC_MAX = 4;
/** Mots du résumé réellement visibles dans une carte d'actualité (le reste est coupé à l'écran). */
export const SUMMARY_WORDS_SHOWN = 30;

/** Nombre de mots d'un texte (séparés par des espaces) ; 0 pour un texte absent ou vide. */
export function countWords(text: string | null | undefined): number {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Durée d'affichage d'une page : max(8 s, 4 s + 0,25 s par mot visible), en millisecondes. */
export function pageDurationMs(words: number): number {
  const safe = Number.isFinite(words) && words > 0 ? words : 0;
  return Math.max(PAGE_MIN_MS, PAGE_BASE_MS + PAGE_PER_WORD_MS * safe);
}

/** Découpe une liste en pages de `size` éléments ; la dernière page peut être plus courte. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new Error("La taille d'une page doit être un entier d'au moins 1.");
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** Page suivante, avec retour à la première après la dernière (boucle). */
export function nextIndex(index: number, length: number): number {
  return length <= 0 ? 0 : (index + 1) % length;
}

/** Page précédente, avec retour à la dernière avant la première (boucle). */
export function prevIndex(index: number, length: number): number {
  return length <= 0 ? 0 : (index - 1 + length) % length;
}

/** Ramène un indice dans les bornes (par exemple quand la liste raccourcit). */
export function clampIndex(index: number, length: number): number {
  return length <= 0 ? 0 : Math.min(Math.max(index, 0), length - 1);
}

type NewsLike = { title: string; body: string | null };

/** Mots visibles d'une carte d'actualité : le titre et au plus `SUMMARY_WORDS_SHOWN` mots de résumé. */
export function newsCardWords(n: NewsLike): number {
  return countWords(n.title) + Math.min(countWords(n.body), SUMMARY_WORDS_SHOWN);
}

/** Durée d'affichage d'une page d'actualités, d'après les mots visibles de ses cartes. */
export function newsPageDurationMs(page: readonly NewsLike[]): number {
  return pageDurationMs(page.reduce((sum, n) => sum + newsCardWords(n), 0));
}

/** Les actualités défilent seulement s'il y en a plus d'une page. */
export function newsPages<T>(items: readonly T[]): T[][] {
  return chunk(items, NEWS_PAGE_SIZE);
}

/** Le défilement continu ne démarre que si le contenu dépasse la largeur disponible. */
export function shouldMarquee(contentWidth: number, containerWidth: number): boolean {
  return contentWidth > containerWidth;
}

/** Durée d'un tour complet (une copie de la liste) à `MARQUEE_PX_PER_SECOND`, en secondes. */
export function marqueeDurationSeconds(contentWidth: number): number {
  return contentWidth > 0 ? contentWidth / MARQUEE_PX_PER_SECOND : 0;
}

type Gravity = { severity: string };

export function isCritical(b: Gravity): boolean {
  return b.severity === "critical";
}

/**
 * Disposition des points bloquants.
 * - `static` : 4 points ou moins, rien ne bouge.
 * - `pinned` : 5 points ou plus avec 1 ou 2 points critiques. Ils restent fixes à gauche ; la colonne de
 *   droite fait défiler les autres, un point à la fois.
 * - `paged` : 5 points ou plus avec 0 point critique (rien à épingler) ou plus de 2 (pas d'épinglage) :
 *   pages de 4.
 */
export type BlockersPlan<T> =
  | { mode: "static"; items: T[] }
  | { mode: "pinned"; pinned: T[]; rotating: T[] }
  | { mode: "paged"; pages: T[][] };

export function planBlockers<T extends Gravity>(items: readonly T[]): BlockersPlan<T> {
  if (items.length <= BLOCKERS_STATIC_MAX) return { mode: "static", items: [...items] };
  const critical = items.filter(isCritical);
  if (critical.length >= 1 && critical.length <= PINNED_CRITICAL_MAX) {
    return { mode: "pinned", pinned: critical, rotating: items.filter((b) => !isCritical(b)) };
  }
  return { mode: "paged", pages: chunk(items, BLOCKERS_PAGE_SIZE) };
}

/**
 * Fenêtre de `size` éléments qui part de `start` et reboucle au début de la liste. Sans doublon tant
 * que la liste a au moins `size` éléments.
 */
export function loopWindow<T>(items: readonly T[], start: number, size: number): T[] {
  if (items.length === 0) return [];
  const count = Math.min(size, items.length);
  const first = ((start % items.length) + items.length) % items.length;
  return Array.from({ length: count }, (_, k) => items[(first + k) % items.length]);
}

/** Les deux points les plus critiques (critiques d'abord, ordre d'origine conservé), pour le mobile. */
export function mostCritical<T extends Gravity>(items: readonly T[], count = 2): T[] {
  return [...items.filter(isCritical), ...items.filter((b) => !isCritical(b))].slice(0, count);
}
