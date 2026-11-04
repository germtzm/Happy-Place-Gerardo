import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@/hooks/use-auto-advance";
import { fetchBlockers, fetchMetrics, fetchNews, type News } from "@/lib/dashboard";
import { filterByTeam, publishedNewsLatestFirst } from "@/lib/home-lists";
import { BlockersBand, MetricsBand, NewsBand } from "./overview-bands";
import { TeamFilter } from "./team-filter";
import { canPickTeam, useTeamFilter, useTeamScope } from "./use-team-filter";

/** Sous 768 px (moins de md) : disposition mobile. */
const MOBILE_QUERY = "(max-width: 767.98px)";

/**
 * Hauteur de la vue : la fenêtre, moins le bandeau, moins le padding vertical de la section (2 x 1.25rem).
 * Sous lg, la barre « Menu » (44 px + 1 px de bordure) occupe aussi une ligne au-dessus de la section.
 */
const HEIGHT_CLS =
  "h-[calc(100dvh-var(--home-header-h,4rem)-2.5rem-45px)] lg:h-[calc(100dvh-var(--home-header-h,4rem)-2.5rem)]";

/** Fond décoratif : dégradés rose (haut droite) et beige (bas gauche) sur #F5F4F1, et quelques vagues. */
function OverviewBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#F5F4F1]"
      style={{
        backgroundImage:
          "radial-gradient(70% 60% at 100% 0%, #FED2CE 0%, rgba(254,210,206,0) 70%), radial-gradient(70% 60% at 0% 100%, #F0D0BC 0%, rgba(240,208,188,0) 70%)",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        fill="none"
        stroke="#28282D"
        strokeWidth="1.5"
        strokeOpacity="0.07"
      >
        <path d="M0 140 C 200 80, 400 200, 600 140 S 1000 80, 1200 150" />
        <path d="M0 190 C 200 130, 400 250, 600 190 S 1000 130, 1200 200" />
        <path d="M0 640 C 220 700, 420 580, 640 640 S 1000 700, 1200 630" />
        <path d="M0 690 C 220 750, 420 630, 640 690 S 1000 750, 1200 680" />
        <path d="M0 740 C 220 800, 420 680, 640 740 S 1000 800, 1200 730" />
      </svg>
    </div>
  );
}

/** Date du jour en capitales, par exemple « MERCREDI 4 NOVEMBRE ». */
function todayLabel(): string {
  return new Date()
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();
}

/**
 * Vue d'ensemble (lecture seule), tenant dans la hauteur de l'écran : indicateurs, actualités, points
 * bloquants. Le sélecteur d'équipe, dans la rangée de titre, filtre les indicateurs et les points
 * bloquants ; les actualités ne sont pas filtrées. Le `h1` de la page est celui de SideNavLayout
 * (masqué), le titre affiché ici n'est qu'une présentation.
 */
export function HomeTopCards({ onReadNews }: { onReadNews: (n: News) => void }) {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const [team] = useTeamFilter();
  const scope = useTeamScope();
  const showFilter = canPickTeam(scope.data);
  const compact = useMediaQuery(MOBILE_QUERY);

  const published = publishedNewsLatestFirst(news.data);
  const shownBlockers = filterByTeam(blockers.data ?? [], team);
  const shownMetrics = filterByTeam(metrics.data ?? [], team);

  return (
    <div
      className={`relative isolate flex min-w-0 flex-col gap-sm overflow-hidden p-sm md:p-md ${HEIGHT_CLS}`}
    >
      <OverviewBackground />

      <div className="flex flex-wrap items-end justify-between gap-x-sm gap-y-xs">
        <div className="rounded-[8px] bg-[#F5F4F1] px-sm py-[6px]">
          <p
            aria-hidden="true"
            className="font-display text-[30px] leading-none text-[#28282D] md:text-[38px]"
          >
            Vue d'ensemble
          </p>
          <p className="mt-[4px] font-label-md text-label-md uppercase text-[#55555A]">
            {todayLabel()}
          </p>
        </div>
        {showFilter && (
          <div className="rounded-[8px] bg-[#F5F4F1] px-sm py-[4px]">
            <TeamFilter />
          </div>
        )}
      </div>

      <MetricsBand
        metrics={shownMetrics}
        isError={metrics.isError}
        loaded={!!metrics.data}
        className="flex-none md:flex-1"
      />
      <NewsBand
        news={published}
        isError={news.isError}
        loaded={!!news.data}
        compact={compact}
        onReadNews={onReadNews}
        className="flex-1 md:flex-[2]"
      />
      <BlockersBand
        blockers={shownBlockers}
        isError={blockers.isError}
        loaded={!!blockers.data}
        compact={compact}
        className="flex-1 md:flex-[2]"
      />
    </div>
  );
}
