import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchBlockers, timeAgo, updateBlockerStatus } from "@/lib/dashboard";
import { filterByTeam } from "@/lib/home-lists";
import { Icon } from "./icon";
import { TeamFilter } from "./team-filter";
import { useTeamFilter } from "./use-team-filter";

export function BlockersSection({ isAdmin, onOpenArchive }: { isAdmin: boolean; onOpenArchive: () => void }) {
  const qc = useQueryClient();
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const [team] = useTeamFilter();
  const items = filterByTeam(blockers.data ?? [], team);
  const setBlocker = useMutation({
    mutationFn: updateBlockerStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blockers"] }),
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <section className="col-span-12 md:col-span-7 rounded-[8px] bg-surface-container-lowest border border-outline-variant p-md">
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <h2 className="font-headline-sm text-headline-sm text-primary">Points Bloquants</h2>
          <span className="text-xs bg-error-container text-on-error-container px-xs py-1 font-label-sm">
            PRIORITÉ HAUTE
          </span>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onOpenArchive()}
          className="text-primary font-label-sm text-label-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
           VOIR L'ARCHIVE
        </button>
      </div>
      <TeamFilter className="mb-md" />
      <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-sm xl:grid-cols-2">
        {blockers.isError && (
          <p className="col-span-full text-body-sm text-error">
            Les points bloquants sont indisponibles.
          </p>
        )}
        {blockers.data && items.length === 0 && (
          <p className="col-span-full text-body-sm text-on-surface-variant italic">
            Aucun point bloquant en cours.
          </p>
        )}
        {items.map((b) => {
          const critical = b.severity === "critical";
          return (
            <div
              key={b.id}
              className={`${critical ? "accent-bar " : ""}flex min-h-28 min-w-0 flex-col gap-sm overflow-hidden rounded-[8px] border border-outline-variant bg-card p-sm sm:flex-row sm:items-stretch sm:justify-between`}
            >
              <div className="flex min-w-0 flex-1 gap-md">
                <Icon
                  name={critical ? "error" : "warning"}
                  className={
                    critical
                      ? "text-error mt-1 [font-variation-settings:'FILL'_1]"
                      : "text-secondary mt-1"
                  }
                />
                <div className="min-w-0">
                  <p className="font-body-md text-primary font-bold wrap-anywhere">{b.title}</p>
                  <p className="line-clamp-3 text-body-sm text-on-surface-variant wrap-anywhere">
                    {b.description}
                  </p>
                  <div className="flex items-center gap-sm mt-xs">
                    <span className="text-[11px] font-label-sm bg-surface-container-highest px-xs py-0.5">
                      {b.department}
                    </span>
                    <span className="text-[11px] font-label-sm text-on-surface-variant">
                      Mis à jour {timeAgo(b.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center sm:justify-end">
                <select
                  aria-label={`Statut de ${b.title}`}
                  value={b.status}
                  disabled={!isAdmin}
                  onChange={(e) => setBlocker.mutate({ id: b.id, status: e.target.value })}
                  className={`min-h-[44px] bg-transparent border-none text-xs font-label-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer max-sm:w-full ${critical ? "text-error" : "text-on-surface-variant"}`}
                >
                  <option>OUVERT</option>
                  <option>EN COURS</option>
                  <option>SURVEILLANCE</option>
                  <option
                    disabled={b.status === "OUVERT"}
                    title={b.status === "OUVERT" ? "Passe d'abord par EN COURS" : undefined}
                  >
                    RÉSOLU
                  </option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
