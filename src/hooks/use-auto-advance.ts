import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Vrai tant que la requête média correspond (faux avant le premier rendu côté navigateur). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Vrai quand l'onglet n'est pas visible. */
function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/**
 * Pilote le défilement automatique d'une section (WCAG 2.2.2). Le défilement est à l'arrêt, pour toutes
 * les raisons suivantes, et reprend seul à la fin de la dernière, sauf pause manuelle :
 * - pause manuelle (bouton) ;
 * - souris au-dessus de la section ;
 * - focus clavier dans la section (`:focus-visible`) ;
 * - onglet caché ;
 * - `prefers-reduced-motion: reduce` (jamais de défilement automatique, boutons manuels à la place).
 *
 * `active` dit si la section a quelque chose à faire défiler. Avec un `delayMs`, `onAdvance` est appelé
 * à l'échéance (un seul minuteur, relancé quand `resetKey` change) ; sans `delayMs`, le hook ne fait que
 * dire si le défilement tourne (défilement continu en CSS). Tous les minuteurs sont nettoyés au démontage.
 */
export function useAutoAdvance({
  active,
  delayMs = null,
  onAdvance,
  resetKey,
}: {
  active: boolean;
  delayMs?: number | null;
  onAdvance?: () => void;
  resetKey?: unknown;
}) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const hidden = usePageHidden();
  const [manualPaused, setManualPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const paused = reducedMotion || manualPaused || hovered || focused || hidden;
  const running = active && !paused;

  const advance = useRef(onAdvance);
  useEffect(() => {
    advance.current = onAdvance;
  });

  useEffect(() => {
    if (!running || delayMs === null) return;
    const id = window.setTimeout(() => advance.current?.(), delayMs);
    return () => window.clearTimeout(id);
  }, [running, delayMs, resetKey]);

  const toggleManual = useCallback(() => setManualPaused((p) => !p), []);

  /** À poser sur le conteneur de la section : survol à la souris et focus clavier. */
  const containerProps = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") setHovered(true);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") setHovered(false);
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.target.matches(":focus-visible")) setFocused(true);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
    },
  };

  return { running, paused, manualPaused, reducedMotion, toggleManual, containerProps };
}
