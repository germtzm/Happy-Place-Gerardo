import { createContext } from "react";

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
};

export const HomeContext = createContext<HomeContextValue>({
  activeId: "",
  onChange: () => {},
  onSubmitRequest: () => {},
  onExport: () => {},
  exporting: false,
});
