import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { AttachmentLink } from "@/components/attachment-link";
import { SubmissionPreview } from "@/components/expandable-card";
import { Linkify } from "@/components/linkify";
import { fetchMySubmissions, timeAgo, type Submission } from "@/lib/dashboard";
import { canManageOwnSubmission, submissionLabel } from "@/lib/own-submission";
import { waitingDays, waitingLabel } from "@/lib/waiting";
import { SubmissionActionsContext } from "./submission-actions-context";

/** Validateurs : undefined = inconnu (masqué), "" = aucun manager. Attente : date de début, si connue. */
export function MySubmissionItem({
  s,
  onRead,
  validators,
  waitingSince,
}: {
  s: Submission;
  onRead: (s: Submission) => void;
  validators?: string;
  waitingSince?: string;
}) {
  const pending = s.status === "en attente";
  const actions = useContext(SubmissionActionsContext);
  const own = !!actions && canManageOwnSubmission(s, actions.email);
  const label = submissionLabel(s.content);
  const actionCls =
    "inline-flex min-h-[44px] items-center border border-outline px-md font-label-md text-label-md uppercase text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  return (
    <div className="p-sm border border-outline-variant bg-card min-w-0 overflow-hidden">
      <SubmissionPreview content={s.content} onOpen={() => onRead(s)} />
      <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
      <p className="text-[11px] font-label-sm text-on-surface-variant uppercase mt-xs">
        {s.status} • {s.team} • {timeAgo(s.created_at)}
      </p>
      {s.hide_author && (
        <p className="text-[11px] font-label-sm uppercase mt-xs">
          Signée : {s.author_name} <span className="text-[#68686D]">(masqué pour l'équipe)</span>
        </p>
      )}
      {pending && (validators !== undefined || waitingSince) && (
        <div className="mt-xs flex flex-wrap items-center gap-xs font-label-sm text-[11px] uppercase">
          {validators !== undefined && (
            <span className="text-[#68686D]">
              Validateur : {validators || "aucun manager assigné"}
            </span>
          )}
          {waitingSince && (
            <span className="rounded-[4px] bg-[#F0D0BC] px-xs py-[2px] text-[#482A1D]">
              {waitingLabel(waitingDays(waitingSince))}
            </span>
          )}
        </div>
      )}
      {own && actions && (
        <div className="mt-xs flex flex-wrap gap-xs">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Modifier ma demande : ${label}`}
            onClick={() => actions.onEdit(s)}
            className={actionCls}
          >
            Modifier
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Supprimer ma demande : ${label}`}
            onClick={() => actions.onDelete(s)}
            className={actionCls}
          >
            Supprimer
          </button>
        </div>
      )}
      {s.status === "refusée" && s.rejection_category && (
        <div className="mt-xs p-xs bg-error-container text-on-error-container text-body-sm wrap-anywhere">
          <p className="font-bold">Motif : {s.rejection_category}</p>
          <p className="whitespace-pre-line">Raison : <Linkify text={s.rejection_note ?? ""} /></p>
        </div>
      )}
    </div>
  );
}

export function MySubmissions({ email, onRead }: { email: string; onRead: (s: Submission) => void }) {
  const mine = useQuery({
    queryKey: ["submissions", "mine", email],
    queryFn: () => fetchMySubmissions(email ?? ""),
    enabled: !!email,
    retry: false,
  });

  if (!mine.data || mine.data.length === 0) return null;

  return (
    <section className="col-span-12 min-w-0 bg-surface-container-lowest border border-outline-variant p-md">
      <h2 className="font-headline-sm text-headline-sm text-primary border-b border-outline-variant pb-sm mb-md">
        Mes soumissions
      </h2>
      <div className="space-y-xs">
        {mine.data.map((s) => (
          <MySubmissionItem key={s.id} s={s} onRead={onRead} />
        ))}
      </div>
    </section>
  );
}
