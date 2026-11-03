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

/** Même règle qu'à la création d'une demande : PDF seulement, 20 Mo au plus. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Message d'erreur pour un fichier refusé, ou null s'il est accepté (mêmes messages qu'à la création). */
export function pdfFileError(file: { type: string; size: number }): string | null {
  if (file.type !== "application/pdf") return "Seuls les fichiers PDF sont acceptés.";
  if (file.size > MAX_PDF_BYTES) return "Le fichier dépasse 20 Mo.";
  return null;
}

/** Ce que l'auteur fait de la pièce jointe en modifiant sa demande. */
export type AttachmentChange =
  { kind: "keep" } | { kind: "remove" } | { kind: "replace"; file: File };

/** Un fichier choisi remplace la pièce jointe ; sinon le retrait demandé ; sinon rien ne change. */
export function attachmentChange(removed: boolean, file: File | null): AttachmentChange {
  if (file) return { kind: "replace", file };
  if (removed) return { kind: "remove" };
  return { kind: "keep" };
}
