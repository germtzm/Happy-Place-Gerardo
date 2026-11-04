import { useQuery } from "@tanstack/react-query";
import {
  fetchMySubmissions,
  fetchValidators,
  fetchWaitingSince,
  type News,
  type Submission,
} from "@/lib/dashboard";
import { ValidatedSubmissions } from "@/components/dashboard-extras";
import { MySubmissionItem } from "./my-submissions";
import { OVERVIEW_ID } from "@/lib/side-nav";
import { HomeSections, type HomeSection } from "./home-sections";
import { RequestActions } from "./request-actions";
import { HomeTopCards } from "./top-cards";
import { useBottomSections } from "./use-bottom-sections";

const TABS = [
  {
    id: "en-attente",
    status: "en attente",
    label: "En attente",
    icon: "hourglass_top",
    title: "Mes demandes en attente",
  },
  {
    id: "validee",
    status: "validée",
    label: "Validées",
    icon: "check_circle",
    title: "Mes demandes validées",
  },
  {
    id: "refusee",
    status: "refusée",
    label: "Refusées",
    icon: "cancel",
    title: "Mes demandes refusées",
  },
] as const;

/** Accueil du collaborateur : menu latéral (Vue d'ensemble, groupe Demandes : une entrée par valeur de submission_status, puis l'équipe). */
export function MyRequestsSections({
  email,
  onRead,
  onReadNews,
}: {
  email: string;
  onRead: (s: Submission) => void;
  onReadNews: (n: News) => void;
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

  const bottomSections = useBottomSections({
    email,
    role: "collaborateur",
    onReadSubmission: onRead,
  });

  const requestSections: HomeSection[] = TABS.map((t) => {
    const items = mine.data?.filter((s) => s.status === t.status) ?? [];
    return {
      id: t.id,
      label: t.label,
      title: t.title,
      icon: t.icon,
      // « Soumettre une demande » et « Exporter le rapport » : dans l'en-tête de la section En attente.
      titleAside: t.id === "en-attente" ? <RequestActions /> : undefined,
      panel: (
        <div className="grid auto-rows-fr grid-cols-1 items-start gap-xs xl:grid-cols-2">
          {mine.isLoading && (
            <p className="col-span-full text-body-sm text-on-surface-variant">Chargement…</p>
          )}
          {mine.isError && (
            <p className="col-span-full text-body-sm text-error">
              Tes demandes sont indisponibles.
            </p>
          )}
          {mine.data && items.length === 0 && (
            <p className="col-span-full text-body-sm text-on-surface-variant italic">
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
        </div>
      ),
    };
  });
  requestSections.push({
    id: "equipe",
    label: "Validées équipe",
    title: "Validées de l'équipe",
    icon: "groups",
    panel: (
      <ValidatedSubmissions
        embedded
        role="collaborateur"
        email={email}
        managerTeams={[]}
        onRead={onRead}
      />
    ),
  });

  const sections: HomeSection[] = [
    {
      id: OVERVIEW_ID,
      label: "Vue d'ensemble",
      icon: "dashboard",
      panel: <HomeTopCards onReadNews={onReadNews} />,
    },
    // Groupe sans panneau ni compteur : les quatre sous-entrées sont les anciennes sections.
    { id: "groupe-demandes", label: "Demandes", icon: "inbox", children: requestSections },
  ];

  return <HomeSections sections={sections} bottomSections={bottomSections} />;
}
