/** Prénom nettoyé, ou null s'il est absent ou vide (jamais de nom inventé). */
export function cleanFirstName(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Première lettre du prénom en majuscule ; « ? » quand le prénom est introuvable. */
export function firstInitial(value: string | null | undefined): string {
  const name = cleanFirstName(value);
  return name ? Array.from(name)[0].toLocaleUpperCase("fr") : "?";
}

/** Texte de l'infobulle et nom accessible de la pilule : « prénom, rôle ». */
export function accountLabel(firstName: string | null | undefined, role: string): string {
  const name = cleanFirstName(firstName);
  const roleText = role.trim().toLocaleLowerCase("fr");
  return `${name ?? "Prénom introuvable"}, ${roleText}`;
}
