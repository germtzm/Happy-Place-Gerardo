import { useQuery } from "@tanstack/react-query";
import { AttachmentLink } from "@/components/attachment-link";
import { AuthorHiddenNote } from "@/components/author-hidden-note";
import { CardActionButton } from "./card-action-button";
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
          : "col-span-12 lg:col-span-4 min-w-0 rounded-[8px] bg-surface-container-lowest border border-outline-variant p-md flex flex-col"
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
          embedded
            ? "grid auto-rows-fr grid-cols-1 items-stretch gap-sm xl:grid-cols-2"
            : "space-y-sm"
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
        {submissions.data?.map((s) => {
          const decides = canReview && canDecideSubmission({ role, email, submission: s });
          return (
            <div
              key={s.id}
              className="flex min-h-28 min-w-0 flex-col gap-sm overflow-hidden rounded-[8px] border border-outline-variant bg-card p-sm sm:flex-row sm:items-stretch"
            >
              <div className="min-w-0 flex-1 space-y-sm">
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
                {canReview && !decides && (
                  <p className="pt-xs text-body-sm italic text-on-surface-variant">
                    Ta demande : un autre manager ou un admin la traite.
                  </p>
                )}
              </div>
              {decides && (
                <div className="flex shrink-0 flex-col justify-center gap-2 sm:items-end">
                  <CardActionButton variant="reject" onClick={() => onReject(s)}>
                    REFUSER
                  </CardActionButton>
                  <CardActionButton variant="validate" onClick={() => onApprove(s)}>
                    VALIDER
                  </CardActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
