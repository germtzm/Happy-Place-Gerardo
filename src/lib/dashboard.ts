import { loadBrowserLib } from "@/lib/browser-lib";
import type { Database, Json } from "@/integrations/supabase/types";
import { applyNewsImage, removeNewsImageFile, type MediaDraft, type NewsLink } from "@/lib/news-media";
import { supabase } from "@/integrations/supabase/client";

export const db = supabase;

type Enums = Database["public"]["Enums"];


export type News = {
  id: string;
  title: string;
  body: string | null;
  author: string;
  author_email?: string | null;
  status: string;
  created_at: string;
  image_path?: string | null;
  links?: unknown;
};

export type Submission = {
  id: string;
  author_name: string;
  team: string;
  content: string;
  status: string;
  created_at: string;
  rejection_category?: string | null;
  rejection_note?: string | null;
  submitted_by_email?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  hide_author?: boolean;
};

export const REJECTION_CATEGORIES = [
  "à clarifier",
  "en désaccord avec les process",
  "doublon",
  "autre",
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export type Blocker = {
  id: string;
  title: string;
  description: string | null;
  department: string;
  severity: string;
  status: string;
  updated_at: string;
};

export type Metric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  trend: "hausse" | "baisse" | "stable";
  previous_value: number | null;
  delta: number | string | null;
};

export const TREND_LABELS: Record<Metric["trend"], string> = {
  hausse: "▲ En hausse",
  baisse: "▼ En baisse",
  stable: "■ Stable",
};

export function deltaText(m: Pick<Metric, "delta" | "unit"> | undefined): string {
  if (!m || m.delta == null) return "";
  const delta = Number(m.delta);
  if (!Number.isFinite(delta) || delta === 0) return "";
  const abs = Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const sign = delta > 0 ? "+" : "−";
  const suffix = m.unit === "%" ? " pts" : m.unit ? ` ${m.unit.trim()}` : "";
  return `${sign}${abs}${suffix}`;
}

export function formatMetricValue(value: number | string, unit: string | null): string {
  const formatted = Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: unit === "%" ? 1 : 0,
    maximumFractionDigits: 1,
  });
  return `${formatted}${unit ?? ""}`;
}

export async function fetchNews(): Promise<News[]> {
  const { data, error } = await db
    .from("news")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as News[];
}

export async function saveDraftNews(input: {
  id?: string;
  title: string;
  body: string;
  author: string;
  author_email: string;
  links: NewsLink[];
  media: MediaDraft;
}) {
  const payload = {
    title: input.title,
    body: input.body,
    author: input.author,
    author_email: input.author_email.toLowerCase(),
    status: "brouillon" as const,
    links: input.links as unknown as Json,
  };
  const { data, error } = input.id
    ? await db.from("news").update(payload).eq("id", input.id).select("id").single()
    : await db.from("news").insert(payload).select("id").single();
  if (error) throw error;
  await applyNewsImage(data.id, input.media);
}

export async function publishDraftNews(id: string) {
  const { data, error } = await db
    .from("news")
    .update({ status: "publiée" })
    .eq("id", id)
    .eq("status", "brouillon")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Vous n'avez pas le droit de publier cette actualité.");
}

export async function deleteDraftNews(id: string, imagePath?: string | null) {
  await removeNewsImageFile(imagePath);
  const { data, error } = await db.from("news").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Vous n'avez pas le droit de supprimer cette actualité.");
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .eq("status", "en attente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export async function fetchMySubmissions(email: string, limit = 10): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .ilike("submitted_by_email", email)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Submission[];
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function exportMyRecentSubmissions(email: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from("submissions")
    .select("created_at,author_name,submitted_by_email,team,content,status")
    .ilike("submitted_by_email", email)
    .in("status", ["en attente", "validée"])
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return 0;

  const header = ["Date", "Auteur", "E-mail", "Équipe", "Question soumise", "Statut"];
  const csv = [
    header.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        new Date(row.created_at).toLocaleString("fr-FR"),
        row.author_name,
        row.submitted_by_email ?? "",
        row.team,
        row.content,
        row.status,
      ].map((value) => csvCell(String(value))).join(";"),
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `soumissions-30-jours-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return rows.length;
}

export async function reviewSubmission(
  input:
    | { id: string; status: "validée" }
    | { id: string; status: "refusée"; rejection_category: RejectionCategory; rejection_note: string },
) {
  const patch =
    input.status === "refusée"
      ? { status: input.status, rejection_category: input.rejection_category, rejection_note: input.rejection_note.trim() }
      : { status: input.status, rejection_category: null, rejection_note: null };
  const { error } = await db
    .from("submissions")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .neq("status", "RÉSOLU")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

export async function fetchResolvedBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .eq("status", "RÉSOLU")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

export type ValidatedSubmission = Submission & { validated_at: string | null };

/** Appel d'une fonction SQL pas encore présente dans les types générés. */
function rpcUntyped<T>(fn: string, args?: Record<string, unknown>) {
  const call = supabase.rpc as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: T | null; error: { message: string } | null }>;
  return call.call(supabase, fn, args);
}

/** Demandes validées lisibles par le connecté ; le masquage de l'auteur est appliqué par la base. */
export async function fetchValidatedSubmissions(): Promise<ValidatedSubmission[]> {
  const { data, error } = await rpcUntyped<ValidatedSubmission[]>("validated_submissions");
  if (error) throw new Error(error.message);
  // validated_at est calculé par la base (l'historique n'est pas lisible par tous les rôles).
  return (data ?? []).sort((a, b) =>
    (b.validated_at ?? b.created_at).localeCompare(a.validated_at ?? a.created_at),
  );
}

export async function updateBlockerStatus(input: { id: string; status: string }) {
  const { error } = await db
    .from("blockers")
    .update({ status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw error;
}

export async function fetchMetrics(): Promise<Metric[]> {
  const { data, error } = await db.from("metrics_with_trend").select("*");
  if (error) throw error;
  return (data ?? []) as Metric[];
}

export async function updateMetric(input: { key: string; value: number }) {
  const { error } = await db
    .from("metrics")
    .update({ value: input.value, updated_at: new Date().toISOString() })
    .eq("key", input.key);
  if (error) throw error;
}

/**
 * Qui peut valider ou refuser une demande en attente (miroir de la base : seul un manager ne peut
 * pas décider de sa propre demande ; un admin le peut toujours ; la base reste la vraie barrière).
 */
export function canDecideSubmission(opts: {
  role: string;
  email: string;
  submission: Pick<Submission, "submitted_by_email">;
}): boolean {
  if (opts.role === "admin") return true;
  if (opts.role !== "manager") return false;
  const author = opts.submission.submitted_by_email;
  return !author || author.toLowerCase() !== opts.email.toLowerCase();
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} minute${min > 1 ? "s" : ""}`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} heure${h > 1 ? "s" : ""}`;
  const days = Math.round(h / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

/* ============================================================
 * CRUD complet — news / submissions / blockers / metrics
 * ========================================================== */

export type NewsInput = { title: string; body: string; author: string; status: string; links?: NewsLink[] };
export type SubmissionInput = {
  author_name: string;
  team: string;
  content: string;
  status: string;
  rejection_category?: string | null;
  rejection_note?: string | null;
  hide_author?: boolean;
};
export type BlockerInput = {
  title: string;
  description: string;
  department: string;
  severity: string;
  status: string;
};
export type MetricInput = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
};

export async function fetchAllNews(): Promise<News[]> {
  const { data, error } = await db
    .from("news")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as News[];
}

function newsRow(input: NewsInput) {
  return { ...input, links: (input.links ?? []) as unknown as Json, status: input.status as Enums["news_status"] };
}

/** Admin : crée l'actualité (pour obtenir son id), puis envoie l'image. */
export async function createNews(input: NewsInput, media?: MediaDraft) {
  const { data, error } = await db.from("news").insert(newsRow(input)).select("id").single();
  if (error) throw error;
  if (media) await applyNewsImage(data.id, media);
}

export async function updateNews(id: string, input: NewsInput, media?: MediaDraft) {
  const { error } = await db.from("news").update(newsRow(input)).eq("id", id);
  if (error) throw error;
  if (media) await applyNewsImage(id, media);
}

export async function deleteNews(id: string, imagePath?: string | null) {
  await removeNewsImageFile(imagePath);
  const { error } = await db.from("news").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  const { data, error } = await db
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

function submissionRow(input: SubmissionInput) {
  const rejected = input.status === "refusée";
  return {
    author_name: input.author_name,
    team: input.team,
    content: input.content,
    status: input.status as Enums["submission_status"],
    rejection_category: rejected ? ((input.rejection_category || null) as Enums["rejection_category"] | null) : null,
    rejection_note: rejected ? input.rejection_note?.trim() || null : null,
  };
}

export async function createSubmission(input: SubmissionInput) {
  const { error } = await db.from("submissions").insert(submissionRow(input));
  if (error) throw error;
}

export const ATTACHMENT_BUCKET = "submission-attachments";
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function submitIdea(input: Omit<SubmissionInput, "status">, file?: File | null) {
  let attachment_path: string | null = null;
  let attachment_name: string | null = null;
  if (file) {
    if (file.type !== "application/pdf") throw new Error("Seuls les fichiers PDF sont acceptés.");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Le fichier dépasse 20 Mo.");
    const { data: u } = await db.auth.getUser();
    if (!u.user) throw new Error("Session expirée");
    attachment_path = `${u.user.id}/${crypto.randomUUID()}.pdf`;
    attachment_name = file.name.slice(0, 200);
    const { error: upErr } = await db.storage
      .from(ATTACHMENT_BUCKET)
      .upload(attachment_path, file, { contentType: "application/pdf" });
    if (upErr) throw upErr;
  }
  const { error } = await db.from("submissions").insert({
    author_name: input.author_name, team: input.team, content: input.content, status: "en attente",
    hide_author: input.hide_author ?? false,
    attachment_path, attachment_name,
  });
  if (error) throw error;
}

/** Prénom du compte connecté (la base le pose comme auteur de ses demandes). */
export async function fetchMyFirstName(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("first_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data?.first_name ?? null;
}

export type NotificationType = "nouvelle_demande" | "decision";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  submission_id: string;
  created_at: string;
  read_at: string | null;
  /** Demande liée, lue avec la RLS existante ; null si elle n'est plus lisible. */
  submission: Submission | null;
};

const NOTIFICATION_LIST_LIMIT = 20;
/** Garde-fou : nombre maximal de lignes lues en base avant filtrage. */
const NOTIFICATION_FETCH_CAP = 200;

/**
 * Règle unique d'affichage, partagée par la liste et le compteur. Une nouvelle demande reste visible
 * (lue ou non) tant que la demande liée est lisible et « en attente ». Une décision n'est visible
 * que tant qu'elle est non lue, même si sa demande n'est plus lisible.
 */
export function isNotificationVisible(n: {
  type: string;
  read_at: string | null;
  submission: Pick<Submission, "status"> | null;
}): boolean {
  if (n.type === "nouvelle_demande") return n.submission?.status === "en attente";
  return n.read_at === null;
}

/**
 * Applique la règle avant la limite, dans l'ordre reçu. `unread` compte les non lues (read_at NULL)
 * parmi les lignes affichées : c'est le nombre de la cloche et du « N NON LUES ».
 */
export function selectVisibleNotifications<T extends Parameters<typeof isNotificationVisible>[0]>(
  items: T[],
  limit = NOTIFICATION_LIST_LIMIT,
): { items: T[]; unread: number } {
  const shown = items.filter(isNotificationVisible).slice(0, limit);
  return { items: shown, unread: shown.filter((n) => n.read_at === null).length };
}

/**
 * Notifications à traiter du connecté (RLS : ses lignes), plus récentes d'abord, avec la demande liée
 * si lisible. Les décisions déjà lues sont exclues dès la lecture ; la liste est limitée à 20 après
 * filtrage.
 */
export async function fetchPendingNotifications(): Promise<{
  items: NotificationItem[];
  unread: number;
}> {
  const { data, error } = await db
    .from("notifications")
    .select("id, type, submission_id, created_at, read_at")
    .or("read_at.is.null,type.eq.nouvelle_demande")
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_FETCH_CAP);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], unread: 0 };

  const ids = [...new Set(rows.map((r) => r.submission_id))];
  const { data: subs, error: subsError } = await db.from("submissions").select("*").in("id", ids);
  if (subsError) throw subsError;
  const byId = new Map((subs ?? []).map((s) => [s.id, s as Submission]));

  return selectVisibleNotifications(
    rows.map((r) => ({
      ...r,
      type: r.type as NotificationType,
      submission: byId.get(r.submission_id) ?? null,
    })),
  );
}

/** Marque une notification comme lue ; sans effet si elle l'est déjà. */
export async function markNotificationRead(id: string) {
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

/* ============================================================
 * Récapitulatif du manager (B04) — préférences d'envoi
 * ========================================================== */

export type RecapFrequency = "desactive" | "quotidien" | "hebdomadaire";

export type RecapPreferences = {
  email: string;
  channel_app: boolean;
  channel_email: boolean;
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  send_day: number;
  /** Heure de Paris, « HH:MM » ou « HH:MM:SS » selon la base. */
  send_time: string;
  frequency: RecapFrequency;
  last_text: string | null;
  last_sent_at: string | null;
  updated_at: string;
};

/** Ce que l'écran envoie à save_my_recap (l'heure est au format « HH:MM »). */
export type RecapInput = {
  channel_app: boolean;
  channel_email: boolean;
  frequency: RecapFrequency;
  send_day: number;
  send_time: string;
};

export const RECAP_FREQUENCIES: RecapFrequency[] = ["desactive", "quotidien", "hebdomadaire"];
export const RECAP_DEFAULT_DAY = 1;
export const RECAP_DEFAULT_TIME = "08:00";
export const RECAP_EMPTY_PREVIEW = "Aucun récapitulatif envoyé pour le moment.";

/** Heures « 00 » à « 23 » (pas de 1) et minutes « 00 », « 15 », « 30 », « 45 » des compteurs d'envoi. */
export const RECAP_HOURS: string[] = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, "0"),
);
export const RECAP_MINUTES: string[] = ["00", "15", "30", "45"];

/** Heure suivante (+1) ou précédente (−1), avec bouclage : 23 puis + donne 00, 00 puis − donne 23. */
export function stepRecapHour(hour: string, delta: 1 | -1): string {
  const parsed = Number.parseInt(hour, 10);
  const current = Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 8;
  return RECAP_HOURS[(current + delta + RECAP_HOURS.length) % RECAP_HOURS.length];
}

/**
 * Minutes suivantes (+15) ou précédentes (−15), avec bouclage et sans toucher à l'heure :
 * 45 puis + donne 00, 00 puis − donne 45.
 */
export function stepRecapMinute(minute: string, delta: 1 | -1): string {
  const found = RECAP_MINUTES.indexOf(minute);
  const current = found >= 0 ? found : 0;
  return RECAP_MINUTES[(current + delta + RECAP_MINUTES.length) % RECAP_MINUTES.length];
}

/** Assemble les deux compteurs au format « HH:MM » envoyé à la base. */
export function recapTimeFromParts(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

/** « 08:15 » ou « 08:15:00 » → { hour: "08", minute: "15" }. */
export function recapTimeParts(time: string | null | undefined): { hour: string; minute: string } {
  const [hour, minute] = recapTimeLabel(time).split(":");
  return { hour: hour ?? "08", minute: minute ?? "00" };
}

const RECAP_SLOT_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)(:00)?$/;

/** « 08:00:00 » → « 08:00 » ; une valeur hors créneau est renvoyée telle quelle (la validation la refuse). */
export function recapTimeLabel(time: string | null | undefined): string {
  if (!time) return RECAP_DEFAULT_TIME;
  return RECAP_SLOT_PATTERN.test(time) ? time.slice(0, 5) : time;
}

function isRecapDay(day: unknown): day is number {
  return typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7;
}

/**
 * Message d'erreur lisible, ou null si la saisie est acceptée. Le jour n'est contrôlé que pour la
 * fréquence « hebdomadaire » ; sans canal, seule la fréquence « désactivé » est acceptée.
 */
export function validateRecapInput(input: RecapInput): string | null {
  if (!RECAP_FREQUENCIES.includes(input.frequency)) return "Choisis une fréquence d'envoi.";
  if (input.frequency !== "desactive" && !input.channel_app && !input.channel_email) {
    return "Choisis au moins un canal de réception.";
  }
  if (input.frequency === "hebdomadaire" && !isRecapDay(input.send_day)) {
    return "Choisis un jour d'envoi, du lundi au dimanche.";
  }
  if (!RECAP_SLOT_PATTERN.test(input.send_time)) {
    return "Choisis une heure d'envoi par créneaux de 15 minutes.";
  }
  return null;
}

/** Valeurs envoyées à la base : hors fréquence hebdomadaire, un jour invalide est remplacé par le lundi. */
export function normalizeRecapInput(input: RecapInput): RecapInput {
  return {
    ...input,
    send_day: isRecapDay(input.send_day) ? input.send_day : RECAP_DEFAULT_DAY,
    send_time: recapTimeLabel(input.send_time),
  };
}

/** « Dernière mise à jour : il y a 2 heures », ou null tant que rien n'est enregistré. */
export function recapUpdatedLabel(updatedAt: string | null | undefined): string | null {
  return updatedAt ? `Dernière mise à jour : ${timeAgo(updatedAt)}` : null;
}

/** Texte de l'aperçu : le dernier récapitulatif envoyé, ou une phrase neutre. */
export function recapPreviewText(lastText: string | null | undefined): string {
  return lastText && lastText.trim() ? lastText : RECAP_EMPTY_PREVIEW;
}

// Les types générés ne connaissent pas encore ces fonctions : appel typé à la main.
type RecapRpcClient = {
  rpc: (
    fn: "get_my_recap" | "save_my_recap",
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Ma préférence de récapitulatif, ou la ligne par défaut non enregistrée (updated_at = maintenant). */
export async function fetchMyRecap(): Promise<RecapPreferences> {
  const { data, error } = await (supabase as unknown as RecapRpcClient).rpc("get_my_recap");
  if (error) throw new Error(error.message);
  return data as RecapPreferences;
}

/** Enregistre ma préférence ; l'appelant invalide ["recap"] ensuite. */
export async function saveMyRecap(input: RecapInput): Promise<RecapPreferences> {
  const invalid = validateRecapInput(input);
  if (invalid) throw new Error(invalid);
  const v = normalizeRecapInput(input);
  const { data, error } = await (supabase as unknown as RecapRpcClient).rpc("save_my_recap", {
    p_channel_app: v.channel_app,
    p_channel_email: v.channel_email,
    p_frequency: v.frequency,
    p_send_day: v.send_day,
    p_send_time: v.send_time,
  });
  if (error) throw new Error(error.message);
  return data as RecapPreferences;
}

const NOTIFICATION_EXCERPT_LENGTH = 80;

/** Titre d'une ligne de notification ; sans demande lisible, un libellé générique sans détail. */
export function notificationTitle(n: {
  type: string;
  submission: Pick<Submission, "author_name" | "team" | "status"> | null;
}): string {
  const s = n.submission;
  if (n.type === "nouvelle_demande") {
    return s ? `Nouvelle demande de ${s.author_name} (${s.team})` : "Nouvelle demande";
  }
  if (s?.status === "validée") return "Ta demande a été validée";
  if (s?.status === "refusée") return "Ta demande a été refusée";
  return "Décision sur ta demande";
}

/** 80 premiers caractères du texte de la demande (calculé à l'affichage, jamais stocké). */
export function notificationExcerpt(content: string | null | undefined): string {
  const text = (content ?? "").replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  if (chars.length <= NOTIFICATION_EXCERPT_LENGTH) return text;
  return `${chars.slice(0, NOTIFICATION_EXCERPT_LENGTH).join("").trimEnd()}…`;
}

export async function downloadAttachment(path: string, name: string | null) {
  const { data, error } = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60, {
    download: name ?? true,
  });
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function updateSubmission(id: string, input: SubmissionInput) {
  const { error } = await db.from("submissions").update(submissionRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteSubmission(id: string) {
  const { error } = await db.from("submissions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllBlockers(): Promise<Blocker[]> {
  const { data, error } = await db
    .from("blockers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Blocker[];
}

export async function createBlocker(input: BlockerInput) {
  const { error } = await db
    .from("blockers")
    .insert({ ...input, severity: input.severity as Enums["blocker_severity"], status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function updateBlocker(id: string, input: BlockerInput) {
  const { error } = await db
    .from("blockers")
    .update({ ...input, severity: input.severity as Enums["blocker_severity"], status: input.status as Enums["blocker_status"], updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBlocker(id: string) {
  const { error } = await db.from("blockers").delete().eq("id", id);
  if (error) throw error;
}

export async function createMetric(input: MetricInput) {
  const { error } = await db.from("metrics").insert(input);
  if (error) throw error;
}

export async function updateMetricRow(key: string, input: MetricInput) {
  const { error } = await db
    .from("metrics")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}

export async function deleteMetric(key: string) {
  const { error } = await db.from("metrics").delete().eq("key", key);
  if (error) throw error;
}

export type SubmissionStatusHistory = {
  id: string;
  submission_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_email: string | null;
  changed_by_name: string | null;
  is_automatic: boolean;
  rejection_category: string | null;
  rejection_note: string | null;
  changed_at: string;
};

export async function fetchSubmissionHistory(submissionId: string): Promise<SubmissionStatusHistory[]> {
  const { data, error } = await supabase
    .from("submission_status_history")
    .select("*")
    .eq("submission_id", submissionId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionStatusHistory[];
}

/** Prénoms des managers validateurs, par équipe. Équipe en erreur : absente du résultat (inconnu ≠ aucun). */
export async function fetchValidators(teams: string[]): Promise<Record<string, string>> {
  const distinct = [...new Set(teams)];
  const out: Record<string, string> = {};
  await Promise.all(
    distinct.map(async (team) => {
      const { data, error } = await rpcUntyped<string>("submission_validators", { _team: team });
      if (!error) out[team] = data ?? "";
    }),
  );
  return out;
}

/** Date depuis laquelle chaque demande attend : dernier passage à « en attente », sinon created_at. */
export async function fetchWaitingSince(
  submissions: { id: string; created_at: string }[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of submissions) out[s.id] = s.created_at;
  if (submissions.length === 0) return out;
  // La base ne renvoie que la date, et seulement pour les demandes du lecteur (ou de ses équipes).
  const { data, error } = await rpcUntyped<{ submission_id: string; waiting_since: string }[]>(
    "submission_waiting_since",
    { _ids: submissions.map((s) => s.id) },
  );
  // Fonction indisponible : on garde created_at.
  if (error) return out;
  for (const h of data ?? []) out[h.submission_id] = h.waiting_since;
  return out;
}

export type MetricHistoryPoint = { id: string; metric_key: string; value: number; recorded_at: string };

export async function fetchMetricHistory(key: string): Promise<MetricHistoryPoint[]> {
  const { data, error } = await supabase
    .from("metrics_history")
    .select("*")
    .eq("metric_key", key)
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as MetricHistoryPoint[];
}

/** Supprime du stockage les pièces jointes échues de la file. Renvoie supprimés et restants. */
export async function processAttachmentDeletionQueue(): Promise<{ deleted: number; remaining: number }> {
  const { data, error } = await supabase
    .from("attachment_deletion_queue")
    .select("id, path")
    .lte("delete_after", new Date().toISOString());
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { deleted: 0, remaining: 0 };
  const { data: removed, error: rmError } = await supabase.storage
    .from("submission-attachments")
    .remove(rows.map((r) => r.path));
  if (rmError) {
    await supabase
      .from("attachment_deletion_queue")
      .update({ last_error: rmError.message })
      .in("id", rows.map((r) => r.id));
    return { deleted: 0, remaining: rows.length };
  }
  const removedSet = new Set((removed ?? []).map((o) => o.name));
  const done = rows.filter((r) => removedSet.has(r.path));
  const missing = rows.filter((r) => !removedSet.has(r.path));
  // Fichiers que remove() n'a pas renvoyés : vérifier s'ils existent encore dans le bucket.
  // S'ils sont déjà absents, ils sont considérés comme supprimés. Si l'appel `list`
  // échoue, on ne peut pas conclure : le fichier reste dans la file avec l'erreur.
  const stillThere: { id: string; path: string; errorMessage: string }[] = [];
  for (const r of missing) {
    const slash = r.path.lastIndexOf("/");
    const folder = slash >= 0 ? r.path.slice(0, slash) : "";
    const fileName = slash >= 0 ? r.path.slice(slash + 1) : r.path;
    const { data: listing, error: listError } = await supabase.storage
      .from("submission-attachments")
      .list(folder, { search: fileName, limit: 100 });
    if (listError) {
      stillThere.push({ id: r.id, path: r.path, errorMessage: listError.message });
    } else if ((listing ?? []).some((o) => o.name === fileName)) {
      stillThere.push({ id: r.id, path: r.path, errorMessage: "Fichier non supprimé par le stockage" });
    } else {
      done.push(r);
    }
  }
  if (done.length) {
    const donePaths = done.map((r) => r.path);
    const { error: linkError } = await supabase
      .from("submissions")
      .update({ attachment_path: null, attachment_name: null })
      .in("attachment_path", donePaths);
    if (linkError) throw linkError;
    const { error: delError } = await supabase
      .from("attachment_deletion_queue")
      .delete()
      .in("id", done.map((r) => r.id));
    if (delError) throw delError;
  }
  if (stillThere.length) {
    for (const r of stillThere) {
      await supabase
        .from("attachment_deletion_queue")
        .update({ last_error: r.errorMessage })
        .eq("id", r.id);
    }
  }
  return { deleted: done.length, remaining: stillThere.length };
}

export async function countAttachmentDeletionQueue(): Promise<number> {
  const { count, error } = await supabase
    .from("attachment_deletion_queue")
    .select("id", { count: "exact", head: true })
    .lte("delete_after", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

export type DepartureDocument = {
  submission_id: string;
  path: string;
  name: string | null;
  created_at: string;
  excerpt: string;
};

export type DepartureNotice = {
  id: string;
  departing_label: string;
  departure_date: string;
  kind: "préavis" | "sans préavis";
  documents: DepartureDocument[];
  created_at: string;
  reminder_at: string | null;
};

/** Un départ est urgent quand un rappel a été envoyé. */
export const isUrgentNotice = (n: DepartureNotice) => !!n.reminder_at;

export async function fetchMyDepartureNotices(email: string): Promise<DepartureNotice[]> {
  const { data, error } = await supabase
    .from("departure_notices")
    .select("id, departing_label, departure_date, kind, documents, created_at, reminder_at")
    .eq("recipient_email", email.toLowerCase())
    .is("closed_at", null)
    .is("downloaded_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DepartureNotice[];
}

export async function markDepartureNoticeDownloaded(id: string) {
  const { error } = await supabase.rpc("mark_departure_notice_downloaded", { _id: id });
  if (error) throw error;
}

export async function downloadDepartureZip(notice: DepartureNotice) {
  const JSZip = await loadBrowserLib<typeof import("jszip")>("/vendor/jszip-3.10.2.min.js", "JSZip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const d of notice.documents) {
    const { data, error } = await supabase.storage.from("submission-attachments").download(d.path);
    if (error) throw error;
    const safe = d.excerpt.replace(/[\\/:*?"<>|\n\r]+/g, " ").trim().slice(0, 60) || "document";
    let name = `${d.created_at.slice(0, 10)} - ${safe}.pdf`;
    let i = 2;
    while (used.has(name)) name = `${d.created_at.slice(0, 10)} - ${safe} (${i++}).pdf`;
    used.add(name);
    zip.file(name, data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documents - ${notice.departing_label}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
