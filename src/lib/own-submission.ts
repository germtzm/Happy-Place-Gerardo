/**
 * Une demande peut être modifiée ou supprimée par son auteur tant qu'elle est « en attente ».
 * La base refait ce contrôle (update_my_submission / delete_my_submission) : ceci ne sert qu'à
 * n'afficher les actions que quand elles ont une chance d'aboutir.
 */
export function canManageOwnSubmission(
  s: { status: string; submitted_by_email?: string | null },
  email: string,
): boolean {
  const mine = (s.submitted_by_email ?? "").trim().toLowerCase();
  return mine !== "" && mine === email.trim().toLowerCase() && s.status === "en attente";
}

/** Début du texte de la demande, pour les libellés accessibles (une demande n'a pas de titre). */
export function submissionLabel(content: string, max = 40): string {
  const text = content.replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("").trimEnd()}…`;
}
