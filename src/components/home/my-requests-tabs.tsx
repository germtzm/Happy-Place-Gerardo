import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMySubmissions, type Submission } from "@/lib/dashboard";
import { MySubmissionItem } from "./my-submissions";

const TABS = [
  { status: "en attente", label: "En attente" },
  { status: "validée", label: "Validées" },
  { status: "refusée", label: "Refusées" },
] as const;

type TabStatus = (typeof TABS)[number]["status"];

/** Moitié basse du collaborateur : ses demandes, une tuile-onglet par valeur de submission_status. */
export function MyRequestsTabs({
  email,
  onRead,
}: {
  email: string;
  onRead: (s: Submission) => void;
}) {
  const [active, setActive] = useState<TabStatus>("en attente");
  const mine = useQuery({
    queryKey: ["submissions", "mine", "all", email],
    queryFn: () => fetchMySubmissions(email, 200),
    enabled: !!email,
    retry: false,
  });
  const countOf = (status: TabStatus) => mine.data?.filter((s) => s.status === status).length ?? 0;
  const shown = mine.data?.filter((s) => s.status === active) ?? [];
  const activeLabel = TABS.find((t) => t.status === active)?.label.toLowerCase();

  return (
    <section className="col-span-12 min-w-0 bg-surface-container-lowest border border-outline-variant p-md">
      <h2 className="font-headline-sm text-headline-sm text-primary border-b border-outline-variant pb-sm mb-md">
        Mes demandes
      </h2>
      <div
        role="tablist"
        aria-label="Statut de mes demandes"
        className="grid grid-cols-3 gap-sm mb-md"
      >
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            id={`tab-${t.status}`}
            aria-selected={active === t.status}
            aria-controls="panel-mes-demandes"
            onClick={() => setActive(t.status)}
            className={`p-sm border text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active === t.status
                ? "border-primary bg-surface-container"
                : "border-outline-variant bg-card"
            }`}
          >
            <span className="block font-display text-[32px] text-primary">{countOf(t.status)}</span>
            <span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">
              {t.label}
            </span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="panel-mes-demandes"
        aria-labelledby={`tab-${active}`}
        className="space-y-xs"
      >
        {mine.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
        {mine.isError && (
          <p className="text-body-sm text-error">Tes demandes sont indisponibles.</p>
        )}
        {mine.data && shown.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">
            Aucune demande {activeLabel}.
          </p>
        )}
        {shown.map((s) => (
          <MySubmissionItem key={s.id} s={s} onRead={onRead} />
        ))}
      </div>
    </section>
  );
}
