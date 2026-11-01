import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ValidatedSubmissions } from "@/components/dashboard-extras";
import {
  fetchBlockers,
  fetchMetrics,
  fetchMyDepartureNotices,
  fetchNews,
  fetchSubmissions,
  isUrgentNotice,
} from "@/lib/dashboard";
import { BlockersSection } from "./blockers-section";
import { MetricsSection } from "./metrics-section";
import { MySubmissions } from "./my-submissions";
import { NewsSection } from "./news-section";
import { PendingSubmissions } from "./pending-submissions";
import { TabTiles, type TabTileDef } from "./tab-tiles";
import { HomeTopCards } from "./top-cards";
import type { HomeProps } from "./types";

export type ManagementTab = { label: string; panel: ReactNode };

/** Compteurs des tuiles, calculés sur les données réelles (mêmes clés de requête que les panneaux). */
function useStaffCounts(email: string) {
  const submissions = useQuery({
    queryKey: ["submissions"],
    queryFn: fetchSubmissions,
    retry: false,
  });
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const departures = useQuery({
    queryKey: ["departure_notices", email],
    queryFn: () => fetchMyDepartureNotices(email),
    enabled: !!email,
  });
  const n = (len: number | undefined) => (len === undefined ? "—" : len);
  return {
    pending: n(submissions.data?.length),
    drafts: n(news.data && news.data.filter((x) => x.status === "brouillon").length),
    blockers: n(blockers.data?.length),
    metrics: n(metrics.data?.length),
    departures: n(departures.data?.length),
    urgentDepartures: departures.data?.filter(isUrgentNotice).length ?? 0,
  };
}

/** Moitié basse manager/admin : cinq tuiles-onglets, seul le panneau actif est visible. */
export function StaffHome({
  isAdmin,
  management,
  ...p
}: HomeProps & { isAdmin: boolean; management: ManagementTab }) {
  const counts = useStaffCounts(p.email);

  const tabs: TabTileDef[] = [
    {
      id: "demandes",
      label: "Demandes",
      count: counts.pending,
      caption: "à traiter",
      panel: (
        <div className="space-y-md">
          <PendingSubmissions
            canReview
            role={p.role}
            email={p.email}
            onRead={p.onReadSubmission}
            onReject={p.onReject}
            onApprove={p.onApprove}
          />
          <ValidatedSubmissions
            role={p.role}
            email={p.email}
            managerTeams={p.managerTeams}
            onRead={p.onReadSubmission}
          />
          <MySubmissions email={p.email} onRead={p.onReadSubmission} />
        </div>
      ),
    },
    {
      id: "actualites",
      label: "Actualités du cabinet",
      count: counts.drafts,
      caption: "brouillons",
      panel: (
        <NewsSection
          isAdmin={isAdmin}
          canWriteNews
          myName={p.myName}
          myEmail={p.email}
          onRead={p.onReadNews}
        />
      ),
    },
    {
      id: "points-bloquants",
      label: "Points bloquants",
      count: counts.blockers,
      caption: "ouverts",
      panel: <BlockersSection isAdmin={isAdmin} onOpenArchive={p.onOpenArchive} />,
    },
    {
      id: "indicateurs",
      label: "Indicateurs clés",
      count: counts.metrics,
      caption: "publiés",
      panel: <MetricsSection isAdmin={isAdmin} />,
    },
    {
      id: "gestion",
      label: management.label,
      count: counts.departures,
      caption:
        counts.urgentDepartures > 0 ? (
          <>
            départs{" "}
            <span className="rounded-[4px] bg-[#FED2CE] px-xs text-[#72020E]">
              {counts.urgentDepartures} urgent{counts.urgentDepartures > 1 ? "s" : ""}
            </span>
          </>
        ) : (
          "départs"
        ),
      panel: management.panel,
    },
  ];

  return (
    <>
      <HomeTopCards onReadNews={p.onReadNews} />
      <div className="min-w-0">
        <TabTiles tabs={tabs} ariaLabel="Sections de l'accueil" defaultId="demandes" />
      </div>
    </>
  );
}
