import { useQuery } from "@tanstack/react-query";
import { AttachmentLink } from "@/components/attachment-link";
import { SubmissionPreview } from "@/components/expandable-card";
import { fetchSubmissions, timeAgo, type Submission } from "@/lib/dashboard";
import { Icon } from "./icon";

export function PendingSubmissions({
  canReview,
  onRead,
  onReject,
  onApprove,
}: {
  canReview: boolean;
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
    <section className="col-span-12 lg:col-span-4 min-w-0 bg-surface-container-lowest border border-outline-variant p-md flex flex-col">
      <div className="flex items-center justify-between border-b border-outline-variant pb-sm mb-md">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          Soumissions en attente
        </h2>
        <div className="bg-tertiary-fixed text-on-tertiary-fixed px-xs py-1 rounded-full font-label-sm text-label-sm">
          {submissions.data?.length ?? 0} NOUVELLES
        </div>
      </div>
      <div className="space-y-sm flex-grow min-w-0">
        {submissions.isError && (
          <p className="text-body-sm text-error">
            Les soumissions sont indisponibles.
          </p>
        )}
        {submissions.data?.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">
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
                <p className="font-body-sm text-primary font-bold wrap-anywhere">{s.author_name}</p>
                <p className="text-[10px] text-on-surface-variant font-label-sm wrap-anywhere">{s.team}</p>
              </div>
              <span className="text-[10px] text-on-surface-variant font-label-sm whitespace-nowrap">
                {timeAgo(s.created_at)}
              </span>
            </div>
            <SubmissionPreview content={s.content} onOpen={() => onRead(s)} />
            <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
            {canReview && <div className="flex gap-xs pt-xs">
              <button
                onClick={() => onReject(s)}
                className="flex-1 py-1 border border-outline text-primary font-label-sm text-label-sm hover:bg-surface-container transition-colors"
              >
                REFUSER
              </button>
              <button
                onClick={() => onApprove(s)}
                className="flex-1 py-1 bg-primary text-on-primary font-label-sm text-label-sm hover:opacity-90 transition-colors"
              >
                VALIDER
              </button>
            </div>}
          </div>
        ))}
      </div>
    </section>
  );
}
