import { useQuery } from "@tanstack/react-query";
import {
  fetchMySubmissions,
  fetchValidators,
  fetchWaitingSince,
  type Submission,
} from "@/lib/dashboard";
import { MySubmissionItem } from "./my-submissions";
import { TabTiles, type TabTileDef } from "./tab-tiles";

const TABS = [
  { id: "en-attente", status: "en attente", label: "En attente" },
  { id: "validee", status: "validée", label: "Validées" },
  { id: "refusee", status: "refusée", label: "Refusées" },
] as const;

/** Moitié basse du collaborateur : ses demandes, une tuile-onglet par valeur de submission_status. */
export function MyRequestsTabs({
  email,
  onRead,
}: {
  email: string;
  onRead: (s: Submission) => void;
}) {
  const mine = useQuery({
    queryKey: ["submissions", "mine", "all", email],
    queryFn: () => fetchMySubmissions(email, 200),
    enabled: !!email,
    retry: false,
  });

  const pending = mine.data?.filter((s) => s.status === "en attente") ?? [];
  const pendingKey = pending.map((s) => s.id).join(",");
  const validators = useQuery({
    queryKey: ["submission_validators", [...new Set(pending.map((s) => s.team))].sort()],
    queryFn: () => fetchValidators(pending.map((s) => s.team)),
    enabled: pending.length > 0,
    retry: false,
  });
  const waiting = useQuery({
    queryKey: ["submission_waiting", pendingKey],
    queryFn: () => fetchWaitingSince(pending),
    enabled: pending.length > 0,
    retry: false,
  });

  const tabs: TabTileDef[] = TABS.map((t) => {
    const items = mine.data?.filter((s) => s.status === t.status) ?? [];
    return {
      id: t.id,
      label: t.label,
      count: items.length,
      panel: (
        <>
          {mine.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
          {mine.isError && (
            <p className="text-body-sm text-error">Tes demandes sont indisponibles.</p>
          )}
          {mine.data && items.length === 0 && (
            <p className="text-body-sm text-on-surface-variant italic">
              Aucune demande {t.label.toLowerCase()}.
            </p>
          )}
          {items.map((s) => (
            <MySubmissionItem
              key={s.id}
              s={s}
              onRead={onRead}
              validators={validators.data?.[s.team]}
              waitingSince={waiting.data?.[s.id] ?? s.created_at}
            />
          ))}
        </>
      ),
    };
  });

  return (
    <section className="col-span-12 min-w-0 bg-surface-container-lowest border border-outline-variant p-md">
      <h2 className="font-headline-sm text-headline-sm text-primary border-b border-outline-variant pb-sm mb-md">
        Mes demandes
      </h2>
      <TabTiles
        tabs={tabs}
        ariaLabel="Statut de mes demandes"
        defaultId="en-attente"
        gridClassName="grid-cols-3"
      />
    </section>
  );
}
