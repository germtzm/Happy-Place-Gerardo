import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CardActionButton } from "@/components/home/card-action-button";
import { Icon } from "@/components/home/icon";
import { cleanFirstName } from "@/lib/account-pill";
import {
  downloadDepartureDocument,
  downloadDepartureZip,
  fetchMyDepartureNoticeProgress,
  fetchMyFirstName,
  isUrgentNotice,
  recordDepartureDownloads,
  type DepartureNoticeWithDownloads,
} from "@/lib/dashboard";
import {
  announceProgress,
  formatDay,
  kindLabel,
  needsAction,
  noticeProgress,
  progressLabel,
  type NoticeProgress,
  type NoticeState,
} from "@/lib/departure-progress";
import { formatDepartureDay } from "@/lib/team-departures";

const errorText = (e: unknown) => (e as Error)?.message || "erreur inconnue";

/** Pastille : une icône et un texte, jamais la couleur seule. */
function Pill({ cls, icon, children }: { cls: string; icon: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-[4px] rounded-full border px-xs py-[2px] font-label-sm text-label-sm ${cls}`}
    >
      <Icon name={icon} className="shrink-0 text-[16px]" />
      <span className="wrap-anywhere">{children}</span>
    </span>
  );
}

const STATE_PILL: Record<NoticeState, { cls: string; icon: string }> = {
  "no-documents": { cls: "border-[#28282D] bg-[#EEEDEA] text-[#28282D]", icon: "info" },
  pending: { cls: "border-[#28282D] bg-white text-[#28282D]", icon: "download" },
  partial: { cls: "border-[#482A1D] bg-[#F0D0BC] text-[#482A1D]", icon: "downloading" },
  complete: { cls: "border-[#0B3D1E] bg-[#8FD3A5] text-[#0B3D1E]", icon: "check_circle" },
};

/**
 * Départs du destinataire (manager ou admin) : tous les avis ouverts, une carte par avis, avec ses
 * téléchargements enregistrés automatiquement. Une région `role="status"` annonce chaque changement.
 */
export function DepartureNotices({ email }: { email: string }) {
  const lower = email.toLowerCase();
  const q = useQuery({
    // Même préfixe que la requête des compteurs de l'accueil : une invalidation les rafraîchit ensemble.
    queryKey: ["departure_notices", "panel", lower],
    queryFn: () => fetchMyDepartureNoticeProgress(email),
    enabled: !!email,
  });
  const nameQuery = useQuery({
    queryKey: ["my_first_name", lower],
    queryFn: () => fetchMyFirstName(email),
    enabled: !!email,
    retry: false,
  });
  const [announcement, setAnnouncement] = useState("");
  const firstName = cleanFirstName(nameQuery.data);

  // À traiter d'abord ; l'ordre d'arrivée est conservé à l'intérieur de chaque groupe.
  const rows = useMemo(
    () =>
      (q.data ?? [])
        .map((n) => ({ n, p: noticeProgress(n.documents, n.downloads) }))
        .sort((a, b) => Number(needsAction(b.p)) - Number(needsAction(a.p))),
    [q.data],
  );

  return (
    <div className="space-y-xs">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {q.isError && <p className="text-body-sm text-error">Les départs sont indisponibles.</p>}
      {!q.isError && !q.data && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {q.data && rows.length === 0 && (
        <p className="text-body-sm text-on-surface-variant italic">Aucun départ en cours.</p>
      )}
      {rows.length > 0 && (
        <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-xs xl:grid-cols-2">
          {rows.map(({ n, p }) => (
            <NoticeCard
              key={n.id}
              notice={n}
              progress={p}
              firstName={firstName}
              onAnnounce={setAnnouncement}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeCard({
  notice: n,
  progress: p,
  firstName,
  onAnnounce,
}: {
  notice: DepartureNoticeWithDownloads;
  progress: NoticeProgress;
  firstName: string | null;
  onAnnounce: (message: string) => void;
}) {
  const qc = useQueryClient();
  const listId = useId();
  const [open, setOpen] = useState(false);
  // Un seul téléchargement à la fois : « zip » ou le chemin du document en cours.
  const [busy, setBusy] = useState<string | null>(null);
  const count = n.documents.length;
  const urgent = isUrgentNotice(n) && needsAction(p);
  const downloaded = new Set(n.downloads.map((d) => d.doc_path));
  const deleteOn = new Date(new Date(n.created_at).getTime() + 7 * 86400000).toISOString();
  const day = formatDepartureDay(n.departure_date);
  // Suite de la phrase, après le libellé du partant (affiché en gras).
  const text =
    count === 0
      ? n.kind === "préavis"
        ? ` quitte Happy Place le ${day}.`
        : " a quitté Happy Place."
      : n.kind === "préavis"
        ? ` quitte Happy Place le ${day} : ${count} document(s) joint(s) à ses demandes seront alors supprimés.`
        : ` a quitté Happy Place : ${count} document(s) joint(s) à ses demandes seront supprimés le ${formatDay(deleteOn)}.`;

  /**
   * Télécharge, puis enregistre seulement si le téléchargement a réussi. Un échec n'enregistre rien.
   * Les deux listes de départs (panneau et compteurs) sont ensuite rafraîchies ensemble.
   */
  async function run(key: string, paths: string[], download: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      try {
        await download();
      } catch (e) {
        const message = `Le téléchargement a échoué : ${errorText(e)}. Rien n'a été enregistré.`;
        toast.error(message);
        onAnnounce(message);
        return;
      }
      try {
        const r = await recordDepartureDownloads(n.id, paths);
        await qc.invalidateQueries({ queryKey: ["departure_notices"] });
        onAnnounce(announceProgress(n.departing_label, r));
      } catch (e) {
        const message = `Le fichier est téléchargé, mais l'enregistrement a échoué : ${errorText(e)}. Réessaie.`;
        toast.error(message);
        onAnnounce(message);
      }
    } finally {
      setBusy(null);
    }
  }

  const state = STATE_PILL[p.state];

  return (
    <div
      role={urgent ? "alert" : undefined}
      className={`flex min-h-28 min-w-0 flex-col gap-sm overflow-hidden rounded-[8px] border p-sm sm:flex-row sm:items-stretch ${
        urgent
          ? "border-[#72020E] bg-[#FED2CE] text-[#72020E]"
          : "border-outline-variant bg-surface-container-lowest"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-xs">
        <div className="flex flex-wrap items-center gap-xs">
          <Pill
            cls={
              n.kind === "préavis"
                ? "border-[#482A1D] bg-[#F0D0BC] text-[#482A1D]"
                : "border-[#28282D] bg-[#28282D] text-[#F9F8F5]"
            }
            icon={n.kind === "préavis" ? "schedule" : "logout"}
          >
            {kindLabel(n.kind)}
          </Pill>
          <Pill cls={state.cls} icon={state.icon}>
            {progressLabel(p, firstName)}
          </Pill>
        </div>
        <p className="font-body-md wrap-anywhere">
          {urgent && <strong>Rappel : </strong>}
          <strong>{n.departing_label}</strong>
          {text}
        </p>
        {open && count > 0 && (
          <ul id={listId} className="space-y-xs border-t border-outline-variant pt-xs">
            {n.documents.map((d) => {
              const done = downloaded.has(d.path);
              return (
                <li
                  key={d.path}
                  className="flex flex-wrap items-center justify-between gap-xs text-body-sm"
                >
                  <span className="min-w-0 wrap-anywhere">
                    <span className="font-bold">{formatDay(d.created_at)}</span> : {d.excerpt}
                    <span className="ml-xs font-label-sm text-label-sm">
                      {done ? "(téléchargé)" : "(à télécharger)"}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    aria-label={`Télécharger le document du ${formatDay(d.created_at)} : ${d.excerpt}`}
                    className="min-h-[44px] font-label-sm text-label-sm text-primary underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    onClick={() => run(d.path, [d.path], () => downloadDepartureDocument(d))}
                  >
                    {busy === d.path ? "Téléchargement…" : "Télécharger"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {count > 0 && (
        <div className="flex shrink-0 flex-col justify-center gap-2 sm:items-end">
          <CardActionButton
            variant="white"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Masquer les documents" : "Voir les documents"}
          </CardActionButton>
          <CardActionButton
            variant="white"
            disabled={busy !== null}
            onClick={() =>
              run(
                "zip",
                n.documents.map((d) => d.path),
                () => downloadDepartureZip(n),
              )
            }
          >
            {busy === "zip" ? "Préparation…" : "Tout télécharger (.zip)"}
          </CardActionButton>
        </div>
      )}
    </div>
  );
}
