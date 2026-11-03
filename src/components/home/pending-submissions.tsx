import { useQuery } from "@tanstack/react-query";
import { AttachmentLink } from "@/components/attachment-link";
import { AuthorHiddenNote } from "@/components/author-hidden-note";
import { SubmissionPreview } from "@/components/expandable-card";
import { canDecideSubmission, fetchSubmissions, timeAgo, type Submission } from "@/lib/dashboard";
import { Icon } from "./icon";

/** Pastille « N NOUVELLES » : à côté du titre de section dans le menu latéral, dans l'en-tête de la carte sinon. */
export function NewCountPill({ count }: { count: number }) {
  return (
    <div className="bg-tertiary-fixed text-on-tertiary-fixed px-xs py-1 rounded-full font-label-sm text-label-sm">
      {count} NOUVELLES
    </div>
  );
}

export function PendingSubmissions({
  canReview,
  role,
  email,
  onRead,
  onReject,
  onApprove,
  embedded = false,
}: {
  /** Dans le menu latéral : ni cadre ni titre (le titre de la section et le compteur sont fournis par la page). */
  embedded?: boolean;
  canReview: boolean;
  role: string;
  /** E-mail en minuscules du connecté. */
  email: string;
  onRead: (s: Submission) => void;
  onReject: (s: Submission) => void;
  onApprove: (s: Submission) => void;
}) {
  const submissions = useQuery({
    queryKey: ["submissions"],
    queryFn: fetchSubmissions,
    retry: false,
  });

  return (
    <section
      className={
        embedded
          ? "min-w-0 flex flex-col"
          : "col-span-12 lg:col-span-4 min-w-0 bg-surface-container-lowest border border-outline-variant p-md flex flex-col"
      }
    >
      {!embedded && (
        <div className="flex items-center justify-between border-b border-outline-variant pb-sm mb-md">
          <h2 className="font-headline-sm text-headline-sm text-primary">Soumissions en attente</h2>
          <NewCountPill count={submissions.data?.length ?? 0} />
        </div>
      )}
      <div
        className={`flex-grow min-w-0 ${
          embedded ? "grid grid-cols-1 items-start gap-sm xl:grid-cols-2" : "space-y-sm"
        }`}
      >
        {submissions.isError && (
          <p className="text-body-sm text-error col-span-full">
            Les soumissions sont indisponibles.
          </p>
        )}
        {submissions.data?.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic col-span-full">
            Aucune soumission en attente.
          </p>
        )}
        {submissions.data?.map((s) => (
          <div
            key={s.id}
            className="p-sm border border-outline-variant bg-card space-y-sm min-w-0 overflow-hidden"
          >
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center">
                <Icon name="person" className="text-sm" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-sm text-primary font-medium wrap-anywhere">
                  {s.author_name}
                  <AuthorHiddenNote s={s} />
                </p>
                <p className="text-[12px] text-on-surface-variant font-label-sm wrap-anywhere">
                  {s.team}
                </p>
              </div>
              <span className="text-[12px] text-on-surface-variant font-label-sm whitespace-nowrap">
                {timeAgo(s.created_at)}
              </span>
            </div>
            <SubmissionPreview content={s.content} onOpen={() => onRead(s)} emphasis />
            <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
            {canReview && canDecideSubmission({ role, email, submission: s }) && (
              <div className="flex justify-end gap-xs pt-xs">
                <button
                  onClick={() => onReject(s)}
                  className="min-h-[44px] w-[120px] border border-outline text-primary font-label-md text-label-md hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  REFUSER
                </button>
                <button
                  onClick={() => onApprove(s)}
                  className="min-h-[44px] w-[120px] bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  VALIDER
                </button>
              </div>
            )}
            {canReview && !canDecideSubmission({ role, email, submission: s }) && (
              <p className="pt-xs text-body-sm italic text-on-surface-variant">
                Ta demande : un autre manager ou un admin la traite.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
