import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatExactDate } from "@/components/expandable-card";
import {
  deltaText,
  fetchBlockers,
  fetchMetricHistory,
  fetchMetrics,
  fetchNews,
  timeAgo,
  type Blocker,
  type Metric,
  type News,
} from "@/lib/dashboard";
import { latestHistory, openBlockersLatestFirst, publishedNewsLatestFirst } from "@/lib/home-lists";
import { Icon } from "./icon";
import { formatMetric, metricLabel, trendText } from "./metrics-format";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const itemCls = `flex min-h-[44px] w-full min-w-0 flex-col gap-[2px] rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest p-sm text-left transition-colors hover:bg-surface-container ${focusRing}`;
const editCls = `inline-flex min-h-[44px] items-center rounded-[8px] border border-outline bg-surface px-md font-label-md text-label-md uppercase text-primary hover:bg-surface-container ${focusRing}`;

type EditTo = "/manage/news" | "/manage/blockers" | "/manage/metrics";

/** Cadre commun : retour, titre de niveau 1, bouton « Modifier » (admin uniquement). */
function ViewShell({
  id,
  title,
  onBack,
  editTo,
  children,
}: {
  id: string;
  title: string;
  onBack: () => void;
  /** Renseigné pour l'admin seulement : lien vers la page de gestion correspondante. */
  editTo?: EditTo;
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={id} className="space-y-md">
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex min-h-[44px] items-center font-label-md text-label-md uppercase text-primary hover:underline ${focusRing}`}
      >
        ← RETOUR À L'ACCUEIL
      </button>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h1
          id={id}
          ref={titleRef}
          tabIndex={-1}
          className="font-headline-lg text-headline-lg text-primary focus:outline-none"
        >
          {title}
        </h1>
        {editTo && (
          <Link to={editTo} className={editCls}>
            MODIFIER
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Status({
  loading,
  error,
  empty,
  errorText,
  emptyText,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  errorText: string;
  emptyText: string;
}) {
  if (loading) return <p className="text-body-md text-[#68686D]">Chargement…</p>;
  if (error)
    return (
      <p role="alert" className="text-body-md text-error">
        {errorText}
      </p>
    );
  if (empty)
    return (
      <p className="rounded-[8px] border border-[#CDCDD1] bg-white p-md text-body-md text-[#68686D]">
        {emptyText}
      </p>
    );
  return null;
}

/** Fenêtre de lecture : Échap et clic sur le fond ferment, le focus revient au bouton d'origine. */
function ReadDialog({
  open,
  title,
  description,
  onClose,
  editTo,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  editTo?: EditTo;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex h-dvh w-full flex-col border border-outline bg-surface-container-lowest shadow-lg focus:outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[85vh] md:w-[min(40rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="flex items-start justify-between gap-sm border-b border-outline-variant p-md">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary wrap-anywhere">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-label-sm text-label-sm text-on-surface-variant">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className={`inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center text-on-surface-variant hover:text-primary ${focusRing}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                close
              </span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 space-y-md overflow-y-auto p-md">{children}</div>
          {editTo && (
            <div className="border-t border-outline-variant p-md">
              <Link to={editTo} className={editCls}>
                MODIFIER
              </Link>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">{label}</dt>
      <dd className="text-body-md text-on-surface whitespace-pre-line wrap-anywhere">{children}</dd>
    </div>
  );
}

/** B18 : toutes les actualités publiées ; le clic ouvre la lecture existante (NewsReader). */
export function NewsListView({
  isAdmin,
  onBack,
  onReadNews,
}: {
  isAdmin: boolean;
  onBack: () => void;
  onReadNews: (n: News) => void;
}) {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const items = publishedNewsLatestFirst(news.data);

  return (
    <ViewShell
      id="news-view-title"
      title="Actualités du cabinet"
      onBack={onBack}
      editTo={isAdmin ? "/manage/news" : undefined}
    >
      <Status
        loading={news.isLoading}
        error={news.isError}
        empty={!!news.data && items.length === 0}
        errorText="Les actualités sont indisponibles."
        emptyText="Aucune actualité publiée."
      />
      <ul className="space-y-xs">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onReadNews(n)}
              aria-haspopup="dialog"
              className={itemCls}
            >
              <span className="flex flex-wrap items-center gap-xs font-label-sm text-label-sm uppercase text-on-surface-variant">
                <span className="rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest px-xs">
                  {n.author}
                </span>
                <span>{timeAgo(n.created_at)}</span>
              </span>
              <span className="font-body-md text-body-md font-bold text-primary wrap-anywhere">
                {n.title}
              </span>
              {n.body && (
                <span className="line-clamp-2 text-body-sm text-on-surface-variant wrap-anywhere">
                  {n.body}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </ViewShell>
  );
}

/** B19 : points ouverts, en cours ou sous surveillance ; lecture seule, lien vers l'archive. */
export function BlockersListView({
  isAdmin,
  onBack,
  onOpenArchive,
}: {
  isAdmin: boolean;
  onBack: () => void;
  onOpenArchive: () => void;
}) {
  const blockers = useQuery({ queryKey: ["blockers"], queryFn: fetchBlockers, retry: false });
  const items = openBlockersLatestFirst(blockers.data);
  const [reading, setReading] = useState<Blocker | null>(null);
  const shown = reading;

  return (
    <ViewShell
      id="blockers-view-title"
      title="Points bloquants"
      onBack={onBack}
      editTo={isAdmin ? "/manage/blockers" : undefined}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onOpenArchive}
        className={`inline-flex min-h-[44px] items-center font-label-md text-label-md uppercase text-primary underline-offset-4 hover:underline ${focusRing}`}
      >
        VOIR L'ARCHIVE DES POINTS RÉSOLUS →
      </button>
      <Status
        loading={blockers.isLoading}
        error={blockers.isError}
        empty={!!blockers.data && items.length === 0}
        errorText="Les points bloquants sont indisponibles."
        emptyText="Aucun point bloquant en cours."
      />
      <ul className="space-y-xs">
        {items.map((b) => {
          const critical = b.severity === "critical";
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setReading(b)}
                aria-haspopup="dialog"
                className={`${critical ? "accent-bar " : ""}${itemCls}`}
              >
                <span className="flex items-start gap-xs">
                  <Icon
                    name={critical ? "error" : "warning"}
                    className={critical ? "text-error" : "text-secondary"}
                  />
                  <span className="min-w-0 font-body-md text-body-md font-bold text-primary wrap-anywhere">
                    {b.title}
                  </span>
                </span>
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">
                  {b.status} • {b.department} • Mis à jour {timeAgo(b.updated_at)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ReadDialog
        open={!!shown}
        title={shown?.title ?? ""}
        description={shown ? `Statut : ${shown.status}` : ""}
        onClose={() => setReading(null)}
        editTo={isAdmin ? "/manage/blockers" : undefined}
      >
        {shown && (
          <dl className="space-y-sm">
            <Field label="Statut">{shown.status}</Field>
            <Field label="Gravité">{shown.severity === "critical" ? "Critique" : "Normale"}</Field>
            <Field label="Département">{shown.department}</Field>
            {shown.description && <Field label="Description">{shown.description}</Field>}
            <Field label="Dernière mise à jour">{formatExactDate(shown.updated_at)}</Field>
          </dl>
        )}
      </ReadDialog>
    </ViewShell>
  );
}

function MetricHistoryList({ metric }: { metric: Metric }) {
  const history = useQuery({
    queryKey: ["metric_history", metric.key],
    queryFn: () => fetchMetricHistory(metric.key),
    retry: false,
  });
  const points = latestHistory(history.data);

  if (history.isLoading)
    return <p className="text-body-sm text-[#68686D]">Chargement de l'historique…</p>;
  // Historique refusé ou indisponible : la fenêtre reste lisible sans cette section.
  if (history.isError)
    return <p className="text-body-sm text-[#68686D]">Historique indisponible.</p>;
  if (points.length === 0)
    return <p className="text-body-sm italic text-[#68686D]">Aucune valeur enregistrée.</p>;
  return (
    <ul className="divide-y divide-[#CDCDD1] rounded-[8px] border border-[#CDCDD1]">
      {points.map((p) => (
        <li key={p.id} className="flex flex-wrap justify-between gap-x-sm px-sm py-xs text-body-sm">
          <span className="text-on-surface-variant">{formatExactDate(p.recorded_at)}</span>
          <span className="font-bold text-primary">
            {formatMetric({ ...metric, value: p.value }, "")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** B20 : tous les indicateurs publiés ; la lecture affiche aussi les dernières valeurs. */
export function MetricsListView({ isAdmin, onBack }: { isAdmin: boolean; onBack: () => void }) {
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const items = metrics.data ?? [];
  const [reading, setReading] = useState<Metric | null>(null);

  return (
    <ViewShell
      id="metrics-view-title"
      title="Indicateurs clés"
      onBack={onBack}
      editTo={isAdmin ? "/manage/metrics" : undefined}
    >
      <Status
        loading={metrics.isLoading}
        error={metrics.isError}
        empty={!!metrics.data && items.length === 0}
        errorText="Les indicateurs sont indisponibles."
        emptyText="Aucun indicateur publié."
      />
      <ul className="space-y-xs">
        {items.map((m) => {
          const delta = deltaText(m);
          return (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => setReading(m)}
                aria-haspopup="dialog"
                className={itemCls}
              >
                <span className="flex flex-wrap items-center justify-between gap-x-sm gap-y-xs">
                  <span className="min-w-[7rem] flex-1">
                    <span className="block font-label-sm text-label-sm uppercase text-on-surface-variant">
                      {metricLabel(m, m.label)}
                    </span>
                    <span className="block font-label-sm text-label-sm text-on-surface-variant">
                      {trendText(m)}
                      {delta && ` · ${delta}`}
                    </span>
                  </span>
                  <span className="font-display text-[22px] text-primary">
                    {formatMetric(m, "")}
                  </span>
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Valeur précédente :{" "}
                  {m.previous_value == null
                    ? "non disponible"
                    : formatMetric({ ...m, value: m.previous_value }, "")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ReadDialog
        open={!!reading}
        title={reading ? metricLabel(reading, reading.label) : ""}
        description="Indicateur clé"
        onClose={() => setReading(null)}
        editTo={isAdmin ? "/manage/metrics" : undefined}
      >
        {reading && (
          <>
            <dl className="space-y-sm">
              <Field label="Valeur">{formatMetric(reading, "")}</Field>
              <Field label="Tendance">
                {trendText(reading)}
                {deltaText(reading) && ` · ${deltaText(reading)}`}
              </Field>
              <Field label="Valeur précédente">
                {reading.previous_value == null
                  ? "Non disponible"
                  : formatMetric({ ...reading, value: reading.previous_value }, "")}
              </Field>
            </dl>
            <div className="space-y-xs">
              <h2 className="font-label-md text-label-md uppercase text-primary">
                Dernières valeurs
              </h2>
              <MetricHistoryList metric={reading} />
            </div>
          </>
        )}
      </ReadDialog>
    </ViewShell>
  );
}
