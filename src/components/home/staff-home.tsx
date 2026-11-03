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
import { useNewsDialog } from "./news-draft-dialog";
import { NewsSection } from "./news-section";
import { NewCountPill, PendingSubmissions } from "./pending-submissions";
import { OVERVIEW_ID, plural } from "@/lib/side-nav";
import { HomeSections, type HomeSection } from "./home-sections";
import { RequestActions } from "./request-actions";
import { useBottomSections } from "./use-bottom-sections";
import { HomeTopCards } from "./top-cards";
import type { HomeProps } from "./types";

export type ManagementTab = {
  /** Nom complet (titre de la section et nom accessible). */
  label: string;
  /** Libellé court et icône de l'entrée du menu. */
  shortLabel: string;
  icon: string;
  panel: ReactNode;
};

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

/** Nom accessible d'une entrée : son nom, puis le compteur et sa légende (rien tant qu'il charge). */
function named(name: string, n: number | string, legend: string): string {
  return typeof n === "number" ? `${name}, ${n} ${legend}` : name;
}

/** Accueil manager/admin : menu latéral (Vue d'ensemble puis cinq sections), seul le panneau actif est visible. */
export function StaffHome({
  isAdmin,
  management,
  ...p
}: HomeProps & { isAdmin: boolean; management: ManagementTab }) {
  const counts = useStaffCounts(p.email);
  const newsDialog = useNewsDialog();
  const bottomSections = useBottomSections({
    email: p.email,
    role: p.role,
    onReadSubmission: p.onReadSubmission,
  });

  const sections: HomeSection[] = [
    {
      id: OVERVIEW_ID,
      label: "Vue d'ensemble",
      icon: "dashboard",
      panel: <HomeTopCards onReadNews={p.onReadNews} />,
    },
    {
      id: "demandes",
      label: "Demandes",
      icon: "inbox",
      count: counts.pending,
      ariaLabel: named("Demandes", counts.pending, "à traiter"),
      titleAside: (
        <div className="flex flex-wrap items-center gap-sm">
          <NewCountPill count={typeof counts.pending === "number" ? counts.pending : 0} />
          <RequestActions />
        </div>
      ),
      panel: (
        <div className="space-y-md">
          <PendingSubmissions
            embedded
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
      label: "Actualités",
      title: "Actualités du cabinet",
      hideTitle: true,
      titleAside: (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => newsDialog.openCreate(e.currentTarget)}
          className="inline-flex min-h-[44px] items-center bg-primary px-md py-xs font-label-md text-label-md text-on-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          + NOUVELLE ACTUALITÉ
        </button>
      ),
      icon: "campaign",
      count: counts.drafts,
      ariaLabel: named(
        "Actualités du cabinet",
        counts.drafts,
        typeof counts.drafts === "number" ? plural(counts.drafts, "brouillon", "brouillons") : "",
      ),
      panel: (
        <NewsSection
          isAdmin={isAdmin}
          canWriteNews
          myName={p.myName}
          myEmail={p.email}
          onRead={p.onReadNews}
          newsDialog={newsDialog}
        />
      ),
    },
    {
      id: "points-bloquants",
      label: "Points bloquants",
      hideTitle: true,
      icon: "warning",
      count: counts.blockers,
      ariaLabel: named(
        "Points bloquants",
        counts.blockers,
        typeof counts.blockers === "number" ? plural(counts.blockers, "ouvert", "ouverts") : "",
      ),
      panel: <BlockersSection isAdmin={isAdmin} onOpenArchive={p.onOpenArchive} />,
    },
    {
      id: "indicateurs",
      label: "Indicateurs",
      title: "Indicateurs clés",
      hideTitle: true,
      icon: "monitoring",
      count: counts.metrics,
      ariaLabel: named(
        "Indicateurs clés",
        counts.metrics,
        typeof counts.metrics === "number" ? plural(counts.metrics, "publié", "publiés") : "",
      ),
      panel: <MetricsSection isAdmin={isAdmin} />,
    },
    {
      id: "gestion",
      label: management.shortLabel,
      title: management.label,
      icon: management.icon,
      count: counts.departures,
      urgent: counts.urgentDepartures > 0,
      ariaLabel:
        named(
          management.label,
          counts.departures,
          typeof counts.departures === "number"
            ? plural(counts.departures, "départ", "départs")
            : "",
        ) +
        (counts.urgentDepartures > 0
          ? `, ${counts.urgentDepartures} ${plural(counts.urgentDepartures, "urgent", "urgents")}`
          : ""),
      panel: management.panel,
    },
  ];

  return <HomeSections sections={sections} bottomSections={bottomSections} />;
}
