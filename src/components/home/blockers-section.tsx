import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchBlockers, timeAgo, updateBlockerStatus } from "@/lib/dashboard";
import { Icon } from "./icon";

export function BlockersSection({ isAdmin, onOpenArchive }: { isAdmin: boolean; onOpenArchive: () => void }) {
  const qc = useQueryClient();
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const setBlocker = useMutation({
    mutationFn: updateBlockerStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blockers"] }),
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <section className="col-span-12 md:col-span-7 bg-surface-container-lowest border border-outline-variant p-md">
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
      <div className="space-y-sm">
        {blockers.isError && (
          <p className="text-body-sm text-error">
            Les points bloquants sont indisponibles.
          </p>
        )}
        {blockers.data?.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">
            Aucun point bloquant en cours.
          </p>
        )}
        {blockers.data?.map((b) => {
          const critical = b.severity === "critical";
          return (
            <div
              key={b.id}
              className={`${critical ? "accent-bar " : ""}bg-card border border-outline-variant p-sm flex items-start justify-between`}
            >
              <div className="flex gap-md">
                <Icon
                  name={critical ? "error" : "warning"}
                  className={
                    critical
                      ? "text-error mt-1 [font-variation-settings:'FILL'_1]"
                      : "text-secondary mt-1"
                  }
                />
                <div>
                  <p className="font-body-md text-primary font-bold">{b.title}</p>
                  <p className="text-body-sm text-on-surface-variant">{b.description}</p>
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
              <select
                aria-label={`Statut de ${b.title}`}
                value={b.status}
                disabled={!isAdmin}
                onChange={(e) => setBlocker.mutate({ id: b.id, status: e.target.value })}
                className={`bg-transparent border-none text-xs font-label-sm focus:outline-none cursor-pointer ${critical ? "text-error" : "text-on-surface-variant"}`}
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
          );
        })}
      </div>
    </section>
  );
}
