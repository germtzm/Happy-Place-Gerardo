import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { fetchMyTeamDepartures } from "@/lib/dashboard";
import { formatDepartureDay } from "@/lib/team-departures";

export const SECTION_CLS =
  "min-w-0 space-y-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md";
export const TITLE_CLS =
  "mb-sm border-b border-[#CDCDD1] pb-xs font-headline-sm text-headline-sm text-primary";

/**
 * Départs vus par le manager (ses équipes) ou l'admin (tous), en lecture seule : libellé, équipe,
 * date et type, sans téléchargement. Le titre dépend du rôle ; la base filtre les lignes.
 */
export function TeamDeparturesList({
  title,
  emptyText = "Aucun départ prévu dans tes équipes.",
  errorText = "Les départs de tes équipes sont indisponibles.",
}: {
  title: string;
  emptyText?: string;
  errorText?: string;
}) {
  const titleId = useId();
  const q = useQuery({
    queryKey: ["team_departures"],
    queryFn: fetchMyTeamDepartures,
    retry: false,
  });
  return (
    <section aria-labelledby={titleId} className={SECTION_CLS}>
      <h2 id={titleId} className={TITLE_CLS}>
        {title}
      </h2>
      {q.isError && <p className="text-body-sm text-error">{errorText}</p>}
      {q.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {q.data && q.data.length === 0 && (
        <p className="text-body-sm text-on-surface-variant italic">{emptyText}</p>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="space-y-xs">
          {q.data.map((d) => (
            <li
              key={`${d.departing_label}|${d.departure_date}|${d.team ?? ""}`}
              className="flex min-w-0 flex-wrap items-center gap-x-sm gap-y-1 border border-outline-variant p-sm text-body-sm"
            >
              <span className="min-w-0 break-words font-bold text-primary">
                {d.departing_label}
              </span>
              <span className="min-w-0 break-words text-on-surface-variant">
                {d.team ?? "Équipe non renseignée"}
              </span>
              <time dateTime={d.departure_date} className="text-on-surface">
                {formatDepartureDay(d.departure_date)}
              </time>
              <span className="border border-outline px-xs py-px font-label-sm text-label-sm text-primary">
                {d.kind === "préavis" ? "Préavis" : "Sans préavis"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
