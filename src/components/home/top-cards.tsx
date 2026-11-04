import { useQuery } from "@tanstack/react-query";
import { useContext, type ReactNode } from "react";
import {
  deltaText,
  fetchBlockers,
  fetchMetrics,
  fetchNews,
  timeAgo,
  type News,
} from "@/lib/dashboard";
import { filterByTeam } from "@/lib/home-lists";
import { FullViewContext, type FullView } from "./full-view-context";
import { Icon } from "./icon";
import { formatMetric, metricLabel, trendText } from "./metrics-format";
import { TeamFilter } from "./team-filter";
import { canPickTeam, useTeamFilter, useTeamScope } from "./use-team-filter";

const BLOCKERS_SHOWN = 3;
const METRICS_SHOWN = 3;

const cardCls =
  "min-w-0 flex flex-col rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-md shadow-none";
const titleCls =
  "font-headline-sm text-headline-sm text-primary border-b border-[#CDCDD1] pb-xs mb-sm";

function SeeAll({ label, view }: { label: string; view: FullView }) {
  const openFullView = useContext(FullViewContext);
  return (
    <button
      type="button"
      id={`see-all-${view}`}
      onClick={() => openFullView(view)}
      className="mt-auto inline-flex min-h-[44px] items-center self-start pt-sm font-label-sm text-label-sm uppercase text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label} →
    </button>
  );
}

function Card({
  title,
  children,
  seeAll,
  view,
  className = "",
}: {
  title: string;
  children: ReactNode;
  seeAll: string;
  view: FullView;
  className?: string;
}) {
  return (
    <section className={`${cardCls} ${className}`}>
      <h2 className={titleCls}>{title}</h2>
      <div className="space-y-xs">{children}</div>
      <SeeAll label={seeAll} view={view} />
    </section>
  );
}

/**
 * Moitié haute de l'accueil (lecture seule). Le sélecteur d'équipe, au-dessus des points bloquants et des
 * indicateurs, choisit parmi ce que la base renvoie ; les actualités ne sont pas filtrées.
 */
export function HomeTopCards({ onReadNews }: { onReadNews: (n: News) => void }) {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const [team] = useTeamFilter();
  const scope = useTeamScope();
  const showFilter = canPickTeam(scope.data);
  const latest = news.data?.filter((n) => n.status === "publiée").slice(0, 2) ?? [];
  const shownBlockers = filterByTeam(blockers.data ?? [], team).slice(0, BLOCKERS_SHOWN);
  const shownMetrics = filterByTeam(metrics.data ?? [], team).slice(0, METRICS_SHOWN);

  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-[3fr_2fr_2fr]">
      <Card
        title="Actualités du cabinet"
        seeAll="VOIR TOUTES LES ACTUALITÉS"
        view="news"
        className={showFilter ? "md:col-start-1 md:row-span-2 md:row-start-1" : ""}
      >
        {news.isError && (
          <p className="text-body-sm text-error">Les actualités sont indisponibles.</p>
        )}
        {news.data && latest.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">Aucune actualité publiée.</p>
        )}
        {latest.map((n) => (
          <button
            type="button"
            key={n.id}
            onClick={() => onReadNews(n)}
            aria-haspopup="dialog"
            className="w-full min-w-0 space-y-[2px] rounded-[8px] bg-surface-container p-xs text-left transition-colors hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <p className="flex flex-wrap items-center gap-xs font-label-sm text-label-sm uppercase text-on-surface-variant">
              <span className="rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest px-xs">
                {n.author}
              </span>
              <span>{timeAgo(n.created_at)}</span>
            </p>
            <p
              title={n.title}
              className="line-clamp-1 font-body-md text-body-md font-bold text-primary wrap-anywhere"
            >
              {n.title}
            </p>
            {n.body && (
              <p className="line-clamp-2 text-body-sm text-on-surface-variant">{n.body}</p>
            )}
          </button>
        ))}
      </Card>

      {showFilter && <TeamFilter className="md:col-span-2 md:col-start-2 md:row-start-1" />}

      <Card title="Points bloquants" seeAll="VOIR TOUS LES POINTS BLOQUANTS" view="blockers">
        {blockers.isError && (
          <p className="text-body-sm text-error">Les points bloquants sont indisponibles.</p>
        )}
        {blockers.data && shownBlockers.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">
            Aucun point bloquant en cours.
          </p>
        )}
        {shownBlockers.map((b) => {
          const critical = b.severity === "critical";
          return (
            <div
              key={b.id}
              className={`${critical ? "accent-bar " : ""}flex items-start gap-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-xs`}
            >
              <Icon
                name={critical ? "error" : "warning"}
                className={critical ? "text-error" : "text-secondary"}
              />
              <div className="min-w-0">
                <p
                  title={b.title}
                  className="line-clamp-1 font-body-md text-body-md font-bold text-primary wrap-anywhere"
                >
                  {b.title}
                </p>
                <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                  {b.status} • {b.department}
                </p>
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="Indicateurs clés" seeAll="VOIR TOUS LES INDICATEURS" view="metrics">
        {metrics.isError && (
          <p className="text-body-sm text-error">Les indicateurs sont indisponibles.</p>
        )}
        {metrics.data && shownMetrics.length === 0 && (
          <p className="text-body-sm text-on-surface-variant italic">Aucun indicateur publié.</p>
        )}
        {shownMetrics.map((m) => (
          <div
            key={m.key}
            className="flex flex-wrap items-center justify-between gap-x-sm gap-y-xs rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-xs"
          >
            <div className="min-w-[7rem] flex-1">
              <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                {metricLabel(m, m.label)}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {trendText(m)}
                {deltaText(m) && ` · ${deltaText(m)}`}
              </p>
            </div>
            <p className="font-display text-[22px] text-primary">{formatMetric(m, "—")}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
