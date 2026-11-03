/** Suivi des téléchargements d'un avis de départ : décompte, libellés et noms de fichier (module pur). */

export type DepartureDocRef = {
  path: string;
  name?: string | null;
  created_at: string;
  excerpt: string;
};
export type DownloadRow = { doc_path: string; downloaded_at: string };

/**
 * - `no-documents` : l'avis n'a aucun document, il n'y a rien à faire ;
 * - `pending` : aucun document téléchargé ;
 * - `partial` : au moins un, pas tous ;
 * - `complete` : tous les documents sont téléchargés.
 */
export type NoticeState = "no-documents" | "pending" | "partial" | "complete";

export type NoticeProgress = {
  total: number;
  done: number;
  state: NoticeState;
  /** Date du dernier enregistrement, seulement quand tout est téléchargé. */
  completedAt: string | null;
};

/** Un avis compte comme « à traiter » seulement s'il a au moins un document. */
export function hasDocuments(documents: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(documents) && documents.length > 0;
}

/** Décompte par document distinct (un chemin enregistré deux fois compte une fois). */
export function noticeProgress(
  documents: readonly Pick<DepartureDocRef, "path">[] | null | undefined,
  downloads: readonly DownloadRow[] | null | undefined,
): NoticeProgress {
  const paths = new Set((documents ?? []).map((d) => d.path));
  const total = paths.size;
  if (total === 0) return { total: 0, done: 0, state: "no-documents", completedAt: null };
  const seen = new Map<string, string>();
  for (const row of downloads ?? []) {
    if (!paths.has(row.doc_path)) continue;
    const before = seen.get(row.doc_path);
    if (before === undefined || row.downloaded_at > before) {
      seen.set(row.doc_path, row.downloaded_at);
    }
  }
  const done = seen.size;
  if (done === 0) return { total, done, state: "pending", completedAt: null };
  if (done < total) return { total, done, state: "partial", completedAt: null };
  const completedAt = [...seen.values()].reduce((a, b) => (a > b ? a : b));
  return { total, done, state: "complete", completedAt };
}

/** À traiter : il reste au moins un document à télécharger. */
export function needsAction(p: Pick<NoticeProgress, "state">): boolean {
  return p.state === "pending" || p.state === "partial";
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Date au format jj/mm/aaaa, à l'heure de Paris. */
export function formatDay(iso: string): string {
  return DAY_FORMAT.format(new Date(iso));
}

/**
 * Texte de la pastille d'état. Le prénom n'est ajouté que s'il est connu (jamais l'e-mail).
 */
export function progressLabel(p: NoticeProgress, firstName?: string | null): string {
  switch (p.state) {
    case "no-documents":
      return "Aucun document à télécharger";
    case "pending":
      return "Documents à télécharger";
    case "partial":
      return `${p.done}/${p.total} documents téléchargés`;
    case "complete": {
      const day = p.completedAt ? ` le ${formatDay(p.completedAt)}` : "";
      const name = (firstName ?? "").trim();
      return `Documents téléchargés${day}${name ? ` par ${name}` : ""}`;
    }
  }
}

/** Pastille Préavis / Sans préavis. */
export function kindLabel(kind: string): string {
  return kind === "préavis" ? "Préavis" : "Sans préavis";
}

/** Phrase lue aux lecteurs d'écran après un enregistrement. */
export function announceProgress(
  label: string,
  r: { done_count: number; total_count: number; is_complete: boolean },
): string {
  return r.is_complete
    ? `Tous les documents de ${label} sont téléchargés.`
    : `${r.done_count}/${r.total_count} documents téléchargés pour ${label}.`;
}

/** Extrait d'une demande réduit à un nom de fichier sûr (60 caractères au plus). */
export function safeDocumentTitle(excerpt: string): string {
  return (
    excerpt
      .replace(/[\\/:*?"<>|\n\r]+/g, " ")
      .trim()
      .slice(0, 60) || "document"
  );
}

/** Nom du fichier enregistré pour un document : son nom d'origine, sinon date et extrait, toujours en .pdf. */
export function documentFileName(
  d: Pick<DepartureDocRef, "name" | "created_at" | "excerpt">,
): string {
  const own = (d.name ?? "").replace(/[\\/:*?"<>|\n\r]+/g, " ").trim();
  const base = own || `${d.created_at.slice(0, 10)} - ${safeDocumentTitle(d.excerpt)}`;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}
