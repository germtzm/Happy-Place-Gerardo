import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ValidatedSubmissions } from "@/components/dashboard-extras";
import {
  fetchBlockers,
  fetchMetrics,
  fetchMyDepartureNotices,
  fetchNews,
  isUrgentNotice,
} from "@/lib/dashboard";
import { BlockersAdminPanel } from "@/components/manage/blockers-admin";
import { MetricsAdminPanel } from "@/components/manage/metrics-admin";
import { NewsAdminPanel } from "@/components/manage/news-admin";
import { useAttachmentQueueCleanup } from "@/components/manage/use-attachment-cleanup";
import { BlockersSection } from "./blockers-section";
import { MetricsSection } from "./metrics-section";
import { MySubmissions } from "./my-submissions";
import { useNewsDialog } from "./news-draft-dialog";
import { NewsSection } from "./news-section";
import { PendingSubmissions } from "./pending-submissions";
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
  /** Titre lu mais non affiché (le h1 reste dans le DOM pour le focus et la navigation au clavier). */
  hideTitle?: boolean;
  panel: ReactNode;
};

/** Compteurs des tuiles, calculés sur les données réelles (mêmes clés de requête que les panneaux). */
function useStaffCounts(email: string) {
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

/** Accueil manager/admin : menu latéral (Vue d'ensemble, groupe Demandes de trois entrées, puis quatre sections), seul le panneau actif est visible. */
export function StaffHome({
  isAdmin,
  management,
  extraSections = [],
  ...p
}: HomeProps & {
  isAdmin: boolean;
  management: ManagementTab;
  /** Entrées ou groupes insérés juste avant l'entrée de gestion (par exemple le groupe Utilisateurs de l'admin). */
  extraSections?: HomeSection[];
}) {
  const counts = useStaffCounts(p.email);
  // Les panneaux d'administration remplacent ceux du manager : même file d'effacement que /manage.
  useAttachmentQueueCleanup(isAdmin);
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
      // Le titre visible est dans HomeTopCards ; le h1 reste dans le DOM (cible du focus), en sr-only.
      hideTitle: true,
      icon: "dashboard",
      panel: <HomeTopCards onReadNews={p.onReadNews} />,
    },
    {
      // Groupe sans panneau ni compteur. « À traiter » garde l'identifiant « demandes » : l'entrée ouverte
      // par défaut (passée par la page) reste la même.
      id: "groupe-demandes",
      label: "Demandes",
      icon: "inbox",
      children: [
        {
          id: "demandes",
          label: "À traiter",
          title: "Demandes à traiter",
          icon: "pending_actions",
          titleAside: <RequestActions />,
          panel: (
            <PendingSubmissions
              embedded
              canReview
              role={p.role}
              email={p.email}
              onRead={p.onReadSubmission}
              onReject={p.onReject}
              onApprove={p.onApprove}
            />
          ),
        },
        {
          id: "demandes-validees",
          label: "Validées",
          title: "Demandes validées",
          // La carte (avec son filtre par équipe) porte déjà ce titre.
          hideTitle: true,
          icon: "task_alt",
          titleAside: <RequestActions />,
          panel: (
            <ValidatedSubmissions
              role={p.role}
              email={p.email}
              managerTeams={p.managerTeams}
              onRead={p.onReadSubmission}
            />
          ),
        },
        {
          id: "mes-demandes",
          label: "Mes demandes",
          title: "Mes demandes",
          icon: "person",
          titleAside: <RequestActions />,
          panel: <MySubmissions embedded email={p.email} onRead={p.onReadSubmission} />,
        },
      ],
    },
    {
      id: "actualites",
      label: "Actualités",
      title: "Actualités du cabinet",
      hideTitle: true,
      // Admin : le panneau d'administration a déjà son bouton « + NOUVELLE ACTUALITÉ ».
      titleAside: isAdmin ? undefined : (
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
      panel: isAdmin ? (
        <NewsAdminPanel />
      ) : (
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
      panel: isAdmin ? (
        <BlockersAdminPanel onOpenArchive={p.onOpenArchive} teamFilter />
      ) : (
        <BlockersSection isAdmin={isAdmin} onOpenArchive={p.onOpenArchive} />
      ),
    },
    {
      id: "indicateurs",
      label: "Indicateurs",
      title: "Indicateurs clés",
      hideTitle: true,
      icon: "monitoring",
      ariaLabel: "Indicateurs clés",
      panel: isAdmin ? <MetricsAdminPanel teamFilter /> : <MetricsSection isAdmin={isAdmin} />,
    },
    ...extraSections,
    {
      id: "gestion",
      label: management.shortLabel,
      title: management.label,
      hideTitle: management.hideTitle,
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
