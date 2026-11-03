import { createContext } from "react";
import type { SideNavItem } from "./side-nav";

/**
 * Navigation et actions de l'accueil, fournies par la page d'accueil. La section active vit là, et
 * nulle part ailleurs : la cloche du bandeau et les entrées du menu la changent par le même chemin.
 */
export type HomeContextValue = {
  activeId: string;
  onChange: (id: string) => void;
  /** Ouvre le formulaire « Soumettre une demande ». */
  onSubmitRequest: () => void;
  /** Génère le rapport de mes soumissions. */
  onExport: () => void;
  exporting: boolean;
  /** Entrées d'action du bas du rail (Données pour l'admin, Déconnexion pour tous), après les sections. */
  railActions: SideNavItem[];
};

export const HomeContext = createContext<HomeContextValue>({
  activeId: "",
  onChange: () => {},
  onSubmitRequest: () => {},
  onExport: () => {},
  exporting: false,
  railActions: [],
});
