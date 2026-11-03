import { createContext } from "react";
import type { Submission } from "@/lib/dashboard";

/**
 * Actions de l'auteur sur sa propre demande « en attente » (fournies par la page d'accueil).
 * Absent (null) : aucune action affichée.
 */
export type SubmissionActions = {
  /** E-mail du connecté, en minuscules. */
  email: string;
  onEdit: (s: Submission) => void;
  onDelete: (s: Submission) => void;
};

export const SubmissionActionsContext = createContext<SubmissionActions | null>(null);
