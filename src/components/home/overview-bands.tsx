import { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAutoAdvance } from "@/hooks/use-auto-advance";
import { deltaText, timeAgo, type Blocker, type Metric, type News } from "@/lib/dashboard";
import {
  BLOCKER_STEP_MS,
  clampIndex,
  loopWindow,
  marqueeDurationSeconds,
  mostCritical,
  newsPageDurationMs,
  newsPages,
  nextIndex,
  planBlockers,
  prevIndex,
  shouldMarquee,
} from "@/lib/home-carousel";
import { FullViewContext, type FullView } from "./full-view-context";
import { Icon } from "./icon";
import { formatMetric, metricLabel } from "./metrics-format";

/** Au plus 10 actualités défilent (sinon la pagination déborde et la boucle devient interminable). */
const NEWS_ROTATION_MAX = 10;

const cardCls = "rounded-[8px] border border-[#CDCDD1] bg-white/[0.92]";
const ringCls =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";
const ghostBtnCls = `inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[#CDCDD1] bg-[#F5F4F1] text-primary hover:bg-surface-container ${ringCls}`;

/** Libellés de gravité : même vocabulaire que `severityLabels` de manage/blockers-admin.tsx. */
const SEVERITY_LABELS: Record<string, string> = {
  critical: "CRITIQUE",
  warning: "AVERTISSEMENT",
  info: "INFORMATION",
};

const SEVERITY_PILL: Record<string, string> = {
  critical: "bg-error-container text-on-error-container",
  warning: "bg-tertiary-fixed text-on-tertiary-fixed",
  info: "bg-secondary-fixed text-primary",
};

/** Retire l'élément de la tabulation et de l'arbre d'accessibilité, quelle que soit la version de React. */
function inertRef(el: HTMLElement | null) {
  el?.setAttribute("inert", "");
}

/* ------------------------------------------------------------------ */
/* Pièces communes                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lien vers la liste complète. Sous md : texte court « VOIR TOUT » sur une seule ligne, le nom complet
 * (par exemple « Voir toutes les actualités ») est porté par `aria-label`.
 */
function SeeAll({
  label,
  view,
  compact,
  ariaLabel,
}: {
  label: string;
  view: FullView;
  compact: boolean;
  ariaLabel: string;
}) {
  const openFullView = useContext(FullViewContext);
  return (
    <button
      type="button"
      id={`see-all-${view}`}
      aria-label={compact ? ariaLabel : undefined}
      onClick={() => openFullView(view)}
      className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-[8px] px-xs font-label-md text-label-md uppercase text-primary underline underline-offset-2 hover:bg-surface-container ${ringCls}`}
    >
      {compact ? "VOIR TOUT" : label} →
    </button>
  );
}

/** Bouton pause / lecture du défilement (WCAG 2.2.2). */
function PauseButton({
  paused,
  onToggle,
  what,
}: {
  paused: boolean;
  onToggle: () => void;
  what: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={
        paused ? `Reprendre le défilement ${what}` : `Mettre en pause le défilement ${what}`
      }
      onClick={onToggle}
      className={ghostBtnCls}
    >
      <Icon name={paused ? "play_arrow" : "pause"} size={20} />
    </button>
  );
}

/** Défilement manuel, proposé à la place du défilement automatique quand le mouvement est réduit. */
function StepButtons({
  what,
  onPrev,
  onNext,
}: {
  what: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex gap-xs">
      <button
        type="button"
        aria-label={`Faire défiler ${what} vers l'arrière`}
        onClick={onPrev}
        className={ghostBtnCls}
      >
        <Icon name="chevron_left" size={20} />
      </button>
      <button
        type="button"
        aria-label={`Faire défiler ${what} vers l'avant`}
        onClick={onNext}
        className={ghostBtnCls}
      >
        <Icon name="chevron_right" size={20} />
      </button>
    </div>
  );
}

/**
 * Bandeau de section : titre (h2) à gauche, à droite le lien « VOIR TOUT » puis les commandes de
 * défilement. Fond plein #F5F4F1 : le texte n'est jamais posé directement sur le fond coloré.
 */
function Band({
  id,
  title,
  seeAll,
  seeAllAria,
  view,
  controls,
  children,
  className = "",
  compact,
  containerProps,
}: {
  id: string;
  title: string;
  seeAll: string;
  seeAllAria: string;
  view: FullView;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  compact: boolean;
  containerProps?: Record<string, unknown>;
}) {
  const headingId = `${id}-title`;
  const link = <SeeAll label={seeAll} view={view} compact={compact} ariaLabel={seeAllAria} />;
  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-h-0 min-w-0 flex-col gap-[4px] overflow-hidden md:gap-xs ${className}`}
      {...containerProps}
    >
      {compact ? (
        // Sous md : une seule ligne de 44 px, titre à gauche, puis pause (ou compteur) et lien sans retour à la ligne.
        <div className="flex h-[44px] shrink-0 items-center justify-between gap-xs rounded-[8px] bg-[#F5F4F1] px-xs">
          <h2
            id={headingId}
            title={title}
            className="line-clamp-1 min-w-0 flex-1 font-display text-[20px] leading-tight text-[#28282D]"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-[4px]">
            {controls}
            {link}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-sm rounded-[8px] bg-[#F5F4F1] px-sm">
          <h2 id={headingId} className="font-display text-[24px] leading-tight text-[#28282D]">
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-xs">
            {link}
            {controls}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Message({ tone = "muted", children }: { tone?: "muted" | "error"; children: ReactNode }) {
  return (
    <p
      className={`${cardCls} p-xs text-body-sm ${tone === "error" ? "text-error" : "italic text-[#55555A]"}`}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

function formatDeltaForSpeech(m: Metric): string {
  const raw = Number(m.delta);
  if (m.delta == null || !Number.isFinite(raw) || raw === 0) return "";
  const abs = Math.abs(raw).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const unit = m.unit === "%" ? " points" : m.unit ? ` ${m.unit.trim()}` : "";
  return ` de ${abs}${unit}`;
}

/** Texte lu par les lecteurs d'écran : « en hausse de 2 points », « en baisse de … » ou « stable ». */
function trendSpeech(m: Metric): string {
  if (m.trend === "hausse") return `en hausse${formatDeltaForSpeech(m)}`;
  if (m.trend === "baisse") return `en baisse${formatDeltaForSpeech(m)}`;
  return "stable";
}

function TrendMark({ m }: { m: Metric }) {
  const delta = deltaText(m);
  const glyph = m.trend === "hausse" ? "▲" : m.trend === "baisse" ? "▼" : "■";
  const tone =
    m.trend === "hausse" ? "text-success" : m.trend === "baisse" ? "text-error" : "text-[#55555A]";
  return (
    <span className="inline-flex items-baseline gap-[4px] font-label-md text-label-md">
      <span aria-hidden="true" className={tone}>
        {glyph}
      </span>
      {delta && (
        // Sous md la place manque : seul le glyphe reste visible, le texte lu garde le delta.
        <span aria-hidden="true" className="hidden text-primary md:inline">
          {delta}
        </span>
      )}
      <span className="sr-only">{trendSpeech(m)}</span>
    </span>
  );
}

function MetricCard({ m }: { m: Metric }) {
  return (
    <li
      className={`${cardCls} flex h-[72px] min-w-0 flex-[1_0_118px] flex-col justify-between gap-[2px] overflow-hidden px-xs py-[6px] md:h-auto md:flex-[1_0_132px]`}
    >
      <p
        title={metricLabel(m, m.label)}
        className="line-clamp-2 font-label-sm text-[11.5px] uppercase leading-tight tracking-[0.08em] text-[#55555A] wrap-anywhere"
      >
        {metricLabel(m, m.label)}
      </p>
      <p className="flex flex-nowrap items-baseline gap-x-xs md:flex-wrap">
        <span className="font-display text-[24px] leading-none text-[#28282D] md:text-[30px]">
          {formatMetric(m, "—")}
        </span>
        <TrendMark m={m} />
      </p>
    </li>
  );
}

export function MetricsBand({
  metrics,
  isError,
  loaded,
  compact,
  className,
}: {
  metrics: Metric[];
  isError: boolean;
  loaded: boolean;
  compact: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [copyWidth, setCopyWidth] = useState(0);
  const auto = useAutoAdvance({ active: overflow });
  // Mouvement réduit : pas de défilement automatique, la liste se parcourt avec les boutons.
  const scrolling = overflow && !auto.reducedMotion;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const copy = copyRef.current;
      if (scrolling && copy) {
        // La copie contient son espace de fin : on le retire pour comparer à la largeur visible.
        const trailing = parseFloat(getComputedStyle(copy).paddingRight) || 0;
        setOverflow(shouldMarquee(copy.offsetWidth - trailing, el.clientWidth));
        setCopyWidth(copy.offsetWidth);
      } else {
        setOverflow(shouldMarquee(el.scrollWidth, el.clientWidth));
        setCopyWidth(copy?.scrollWidth ?? 0);
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (copyRef.current) observer.observe(copyRef.current);
    return () => observer.disconnect();
  }, [scrolling, auto.reducedMotion, metrics.length]);

  function scrollByCard(direction: 1 | -1) {
    containerRef.current?.scrollBy({ left: direction * 150, behavior: "smooth" });
  }

  const cards = metrics.map((m) => <MetricCard key={m.key} m={m} />);

  return (
    <Band
      id="overview-metrics"
      title="Indicateurs clés"
      seeAll="VOIR TOUS LES INDICATEURS"
      seeAllAria="Voir tout : indicateurs"
      view="metrics"
      compact={compact}
      className={className}
      containerProps={auto.containerProps}
      controls={
        overflow &&
        (auto.reducedMotion ? (
          <StepButtons
            what="les indicateurs"
            onPrev={() => scrollByCard(-1)}
            onNext={() => scrollByCard(1)}
          />
        ) : (
          <PauseButton
            paused={auto.manualPaused}
            onToggle={auto.toggleManual}
            what="des indicateurs"
          />
        ))
      }
    >
      {isError && <Message tone="error">Les indicateurs sont indisponibles.</Message>}
      {loaded && !isError && metrics.length === 0 && <Message>Aucun indicateur publié.</Message>}
      {metrics.length > 0 && (
        <div
          ref={containerRef}
          className={`flex min-w-0 ${auto.reducedMotion ? "overflow-x-auto" : "overflow-hidden"}`}
        >
          {scrolling ? (
            <div
              className="home-marquee flex w-max"
              style={
                {
                  "--home-marquee-duration": `${marqueeDurationSeconds(copyWidth)}s`,
                  animationPlayState: auto.running ? "running" : "paused",
                } as CSSProperties
              }
            >
              <ul ref={copyRef} className="flex shrink-0 gap-sm pr-sm">
                {cards}
              </ul>
              <ul ref={inertRef} aria-hidden="true" className="flex shrink-0 gap-sm pr-sm">
                {cards}
              </ul>
            </div>
          ) : (
            <ul ref={copyRef} className="flex w-full min-w-full gap-sm">
              {cards}
            </ul>
          )}
        </div>
      )}
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* Actualités                                                          */
/* ------------------------------------------------------------------ */

function NewsCard({
  n,
  compact,
  onRead,
}: {
  n: News;
  compact: boolean;
  onRead: (n: News) => void;
}) {
  if (compact) {
    // Sous md : toute la carte est le lien (54 px), pastille d'auteur et titre sur une ligne chacun.
    return (
      <button
        type="button"
        onClick={() => onRead(n)}
        aria-haspopup="dialog"
        title={n.title}
        className={`${cardCls} flex h-[54px] w-full min-w-0 items-center gap-xs overflow-hidden px-xs text-left ${ringCls}`}
      >
        <span className="line-clamp-1 max-w-[40%] shrink-0 rounded-[8px] border border-[#CDCDD1] bg-[#F5F4F1] px-xs font-label-sm text-label-sm uppercase text-[#28282D]">
          {n.author}
        </span>
        <span className="line-clamp-1 min-w-0 flex-1 font-display text-[16px] leading-tight text-[#28282D] wrap-anywhere">
          {n.title}
        </span>
      </button>
    );
  }
  return (
    <article className={`${cardCls} flex min-h-0 min-w-0 flex-col gap-[4px] overflow-hidden p-xs`}>
      <p className="flex flex-wrap items-center gap-xs font-label-sm text-label-sm uppercase text-[#55555A]">
        <span className="rounded-[8px] border border-[#CDCDD1] bg-[#F5F4F1] px-xs text-[#28282D]">
          {n.author}
        </span>
        <span>{timeAgo(n.created_at)}</span>
      </p>
      <h3
        title={n.title}
        className="line-clamp-2 font-display text-[24px] leading-[1.2] text-[#28282D] wrap-anywhere"
      >
        {n.title}
      </h3>
      {n.body && (
        <p className="line-clamp-2 min-h-0 font-body-md text-[15px] leading-[1.4] text-[#55555A] wrap-anywhere">
          {n.body}
        </p>
      )}
      <button
        type="button"
        onClick={() => onRead(n)}
        aria-haspopup="dialog"
        aria-label={`Lire l'actualité : ${n.title}`}
        className={`mt-auto inline-flex min-h-[44px] items-center self-start rounded-[8px] font-label-md text-label-md uppercase text-[#28282D] underline underline-offset-2 ${ringCls}`}
      >
        LIRE L'ACTUALITÉ →
      </button>
    </article>
  );
}

export function NewsBand({
  news,
  isError,
  loaded,
  compact,
  onReadNews,
  className,
}: {
  news: News[];
  isError: boolean;
  loaded: boolean;
  compact: boolean;
  onReadNews: (n: News) => void;
  className?: string;
}) {
  const pages = newsPages(news.slice(0, NEWS_ROTATION_MAX));
  const [page, setPage] = useState(0);
  const current = clampIndex(page, pages.length);
  const auto = useAutoAdvance({
    active: pages.length > 1,
    delayMs: pages.length > 1 ? newsPageDurationMs(pages[current]) : null,
    onAdvance: () => setPage(nextIndex(current, pages.length)),
    resetKey: current,
  });
  const multiple = pages.length > 1;

  return (
    <Band
      id="overview-news"
      title="Actualités du cabinet"
      seeAll="VOIR TOUTES LES ACTUALITÉS"
      seeAllAria="Voir tout : actualités"
      view="news"
      compact={compact}
      className={className}
      containerProps={auto.containerProps}
      controls={
        multiple && (
          <>
            {/* Sous md, la pause et les boutons suffisent : les points de pagination sont masqués. */}
            <div className="hidden items-center md:flex">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Page ${i + 1} sur ${pages.length}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => setPage(i)}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] ${ringCls}`}
                >
                  <span
                    aria-hidden="true"
                    className={`block h-[10px] w-[10px] rounded-full border border-[#28282D] ${
                      i === current ? "bg-[#28282D]" : "bg-transparent"
                    }`}
                  />
                </button>
              ))}
            </div>
            {auto.reducedMotion ? (
              <StepButtons
                what="les actualités"
                onPrev={() => setPage(prevIndex(current, pages.length))}
                onNext={() => setPage(nextIndex(current, pages.length))}
              />
            ) : (
              <PauseButton
                paused={auto.manualPaused}
                onToggle={auto.toggleManual}
                what="des actualités"
              />
            )}
          </>
        )
      }
    >
      {isError && <Message tone="error">Les actualités sont indisponibles.</Message>}
      {loaded && !isError && news.length === 0 && <Message>Aucune actualité publiée.</Message>}
      {pages.length > 0 && (
        <div
          key={current}
          className="home-fade grid h-full min-h-0 grid-cols-1 content-start gap-[6px] md:grid-cols-2 md:gap-sm"
        >
          {pages[current].map((n) => (
            <NewsCard key={n.id} n={n} compact={compact} onRead={onReadNews} />
          ))}
        </div>
      )}
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* Points bloquants                                                    */
/* ------------------------------------------------------------------ */

function BlockerCard({ b, compact }: { b: Blocker; compact: boolean }) {
  const critical = b.severity === "critical";
  const pill = (
    <span
      className={`shrink-0 whitespace-nowrap rounded-[8px] px-xs ${SEVERITY_PILL[b.severity] ?? SEVERITY_PILL.info}`}
    >
      {SEVERITY_LABELS[b.severity] ?? SEVERITY_LABELS.info}
    </span>
  );
  if (compact) {
    // Sous md : 54 px, statut sur une ligne, titre sur une ligne (titre complet en infobulle).
    return (
      <div
        className={`${critical ? "accent-bar " : ""}${cardCls} flex h-[54px] min-w-0 flex-col justify-center gap-[2px] overflow-hidden px-xs`}
      >
        <p className="flex items-center gap-xs font-label-sm text-label-sm uppercase text-[#55555A]">
          {pill}
          <span className="line-clamp-1 min-w-0">
            {b.status} • {b.department}
          </span>
        </p>
        <p
          title={b.title}
          className="line-clamp-1 font-body-md text-[16px] font-bold leading-tight text-[#28282D] wrap-anywhere"
        >
          {b.title}
        </p>
      </div>
    );
  }
  return (
    <div
      className={`${critical ? "accent-bar " : ""}${cardCls} flex min-h-0 min-w-0 flex-col justify-center gap-[4px] overflow-hidden p-xs`}
    >
      <p className="flex flex-wrap items-center gap-xs font-label-sm text-label-sm uppercase text-[#55555A]">
        {pill}
        <span>
          {b.status} • {b.department}
        </span>
      </p>
      <p className="font-body-md text-[19px] font-bold leading-snug text-[#28282D] wrap-anywhere">
        {b.title}
      </p>
    </div>
  );
}

export function BlockersBand({
  blockers,
  isError,
  loaded,
  compact,
  className,
}: {
  blockers: Blocker[];
  isError: boolean;
  loaded: boolean;
  compact: boolean;
  className?: string;
}) {
  const plan = planBlockers(blockers);
  // Sur mobile, rien ne défile : les 2 points les plus critiques et un compteur.
  const rotates = !compact && plan.mode !== "static";
  const length =
    plan.mode === "pinned" ? plan.rotating.length : plan.mode === "paged" ? plan.pages.length : 0;
  const [index, setIndex] = useState(0);
  const current = clampIndex(index, length);
  const auto = useAutoAdvance({
    active: rotates,
    delayMs: rotates ? BLOCKER_STEP_MS : null,
    onAdvance: () => setIndex(nextIndex(current, length)),
    resetKey: current,
  });

  const total = blockers.length;
  const seeAllLabel = total >= 5 ? `VOIR TOUS (${total})` : "VOIR TOUS LES POINTS BLOQUANTS";
  const mobileShown = mostCritical(blockers, 2);

  let body: ReactNode = null;
  if (compact) {
    body = (
      <div className="flex min-h-0 flex-col gap-[6px]">
        {mobileShown.map((b) => (
          <BlockerCard key={b.id} b={b} compact />
        ))}
      </div>
    );
  } else if (plan.mode === "pinned") {
    body = (
      <div className="grid h-full min-h-0 grid-cols-2 gap-sm">
        <div className="grid min-h-0 grid-rows-2 gap-sm">
          {plan.pinned.map((b) => (
            <BlockerCard key={b.id} b={b} compact={false} />
          ))}
        </div>
        <div className="grid min-h-0 grid-rows-2 gap-sm">
          {loopWindow(plan.rotating, current, 2).map((b) => (
            <BlockerCard key={b.id} b={b} compact={false} />
          ))}
        </div>
      </div>
    );
  } else {
    const shown = plan.mode === "paged" ? plan.pages[current] : plan.items;
    body = (
      <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-sm">
        {shown.map((b) => (
          <BlockerCard key={b.id} b={b} compact={false} />
        ))}
      </div>
    );
  }

  return (
    <Band
      id="overview-blockers"
      title="Points bloquants"
      seeAll={seeAllLabel}
      seeAllAria={
        total >= 5 ? `Voir tout : points bloquants (${total})` : "Voir tout : points bloquants"
      }
      view="blockers"
      compact={compact}
      className={className}
      containerProps={auto.containerProps}
      controls={
        <>
          {compact && total > mobileShown.length && (
            <span className="whitespace-nowrap font-label-md text-label-md uppercase text-[#28282D]">
              {mobileShown.length} SUR {total}
            </span>
          )}
          {rotates &&
            (auto.reducedMotion ? (
              <StepButtons
                what="les points bloquants"
                onPrev={() => setIndex(prevIndex(current, length))}
                onNext={() => setIndex(nextIndex(current, length))}
              />
            ) : (
              <PauseButton
                paused={auto.manualPaused}
                onToggle={auto.toggleManual}
                what="des points bloquants"
              />
            ))}
        </>
      }
    >
      {isError && <Message tone="error">Les points bloquants sont indisponibles.</Message>}
      {loaded && !isError && blockers.length === 0 && (
        <Message>Aucun point bloquant en cours.</Message>
      )}
      {blockers.length > 0 && body}
    </Band>
  );
}
