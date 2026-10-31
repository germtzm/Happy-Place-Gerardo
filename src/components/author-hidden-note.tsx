import type { Submission } from "@/lib/dashboard";

/** Mention grise après le prénom. Absente pour un lecteur à qui la base a déjà masqué l'auteur (e-mail renvoyé à NULL). */
export function AuthorHiddenNote({
  s,
}: {
  s: Pick<Submission, "hide_author" | "submitted_by_email">;
}) {
  if (!s.hide_author || !s.submitted_by_email) return null;
  return <span className="font-normal text-[#68686D]"> (masqué pour l'équipe)</span>;
}
