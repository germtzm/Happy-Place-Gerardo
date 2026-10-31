import { useQuery } from "@tanstack/react-query";
import { fetchBlockers, fetchMetrics, fetchNews, timeAgo, type News } from "@/lib/dashboard";
import { Icon } from "./icon";
import { MetricTiles } from "./metrics-section";

const cardCls =
  "col-span-12 md:col-span-4 min-w-0 bg-surface-container-lowest border border-outline-variant p-md";
const titleCls =
  "font-headline-sm text-headline-sm text-primary border-b border-outline-variant pb-sm mb-md";

/** Moitié haute de l'accueil, identique pour tous les rôles : 2 actualités, points bloquants, indicateurs (lecture seule). */
export function HomeTopCards({ onReadNews }: { onReadNews: (n: News) => void }) {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const latest = news.data?.filter((n) => n.status === "publiée").slice(0, 2) ?? [];
  const shownBlockers = blockers.data?.slice(0, 3) ?? [];
  const hiddenBlockers = (blockers.data?.length ?? 0) - shownBlockers.length;

  return (
    <div className="bento-grid">
      <section className={cardCls}>
        <h2 className={titleCls}>Actualités</h2>
        <div className="space-y-xs">
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
              className="w-full text-left p-sm bg-surface-container hover:bg-surface-container-high transition-colors group min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <p className="font-body-md text-primary group-hover:underline wrap-anywhere">
                {n.title}
              </p>
              <p className="text-xs text-on-surface-variant uppercase font-label-sm">
                Publiée {timeAgo(n.created_at)} • Par {n.author}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className={cardCls}>
        <h2 className={titleCls}>Points bloquants</h2>
        <div className="space-y-xs">
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
                className={`${critical ? "accent-bar " : ""}bg-card border border-outline-variant p-sm flex items-start gap-sm`}
              >
                <Icon
                  name={critical ? "error" : "warning"}
                  className={critical ? "text-error" : "text-secondary"}
                />
                <div className="min-w-0">
                  <p className="font-body-md text-primary font-bold wrap-anywhere">{b.title}</p>
                  <p className="text-[11px] font-label-sm text-on-surface-variant uppercase">
                    {b.department} • {b.status}
                  </p>
                </div>
              </div>
            );
          })}
          {hiddenBlockers > 0 && (
            <p className="text-body-sm text-on-surface-variant">
              + {hiddenBlockers} autre{hiddenBlockers > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>

      <section className={cardCls}>
        <h2 className={titleCls}>Indicateurs</h2>
        <MetricTiles metrics={metrics.data} />
      </section>
    </div>
  );
}
