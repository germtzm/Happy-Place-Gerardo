import { createContext } from "react";

export type FullView = "news" | "blockers" | "metrics";

/** Ouvre l'une des vues complètes de l'accueil (fournie par la page d'accueil). */
export const FullViewContext = createContext<(view: FullView) => void>(() => {});
