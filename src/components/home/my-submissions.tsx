import { useQuery } from "@tanstack/react-query";
import { AttachmentLink } from "@/components/attachment-link";
import { SubmissionPreview } from "@/components/expandable-card";
import { Linkify } from "@/components/linkify";
import { fetchMySubmissions, timeAgo, type Submission } from "@/lib/dashboard";

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
          <div key={s.id} className="p-sm border border-outline-variant bg-card min-w-0 overflow-hidden">
            <SubmissionPreview content={s.content} onOpen={() => onRead(s)} />
            <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
            <p className="text-[11px] font-label-sm text-on-surface-variant uppercase mt-xs">
              {s.status} • {s.team} • {timeAgo(s.created_at)}
            </p>
            {s.status === "refusée" && s.rejection_category && (
              <div className="mt-xs p-xs bg-error-container text-on-error-container text-body-sm wrap-anywhere">
                <p className="font-bold">Motif : {s.rejection_category}</p>
                <p className="whitespace-pre-line">Raison : <Linkify text={s.rejection_note ?? ""} /></p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
