import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { deltaText, fetchMetrics, TREND_LABELS, updateMetric, type Metric } from "@/lib/dashboard";
import { Icon } from "./icon";

const PERF_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAz-Y4URSqOCzUaVC6vomdu54tTiFPC_bF9A_h0SjxJ1mq2OlNfOyeKTNkPIgtPRloYwE5JrWFm2FHBNUq0GScs0ALDVMiq16FLu95dHNGPjmybEoIb2uyz1OGozRn0XkudSMukcPY4gKfeOJMR_KAnhYbkZifswTCbpCs_aHZyMuoZRz_oc4KsWtWiryTdwVD0EKyvxScj3palbDIM2wMlnH0njPGj912mRwhMmTo3Yu07l6xfVv2Zuw";

function trendText(m: Metric | undefined) {
  return m ? TREND_LABELS[m.trend] : "";
}

function metricOf(metrics: Metric[] | undefined, key: string) {
  return metrics?.find((m) => m.key === key);
}

function formatMetric(m: Metric | undefined, fallback: string) {
  if (!m) return fallback;
  const v = Number(m.value);
  const formatted = m.unit === "%" ? v.toFixed(1) : v.toLocaleString("fr-FR");
  return `${formatted}${m.unit ?? ""}`;
}

function metricLabel(metric: Metric | undefined, fallback: string) {
  if (!metric) return fallback;
  if (metric.key === "training_kpi") return "Taux de placement";
  if (metric.key === "active_users") return "Missions actives";
  return metric.label;
}

export function MetricTiles({ metrics }: { metrics: Metric[] | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-sm mb-md">
      <div className="p-sm bg-card border border-outline-variant text-center">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
          {metricLabel(metricOf(metrics, "training_kpi"), "Taux de placement")}
        </p>
        <p className="font-display text-[32px] text-primary">
          {formatMetric(metricOf(metrics, "training_kpi"), "—")}
        </p>
        <p className="text-[10px] text-on-surface-variant font-label-sm">
          {trendText(metricOf(metrics, "training_kpi"))}
          {deltaText(metricOf(metrics, "training_kpi")) &&
            ` · ${deltaText(metricOf(metrics, "training_kpi"))}`}
        </p>
      </div>
      <div className="p-sm bg-card border border-outline-variant text-center">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
          {metricLabel(metricOf(metrics, "active_users"), "Missions actives")}
        </p>
        <p className="font-display text-[32px] text-primary">
          {formatMetric(metricOf(metrics, "active_users"), "—")}
        </p>
        <p className="text-[10px] text-on-surface-variant font-label-sm">
          {trendText(metricOf(metrics, "active_users"))}
          {deltaText(metricOf(metrics, "active_users")) &&
            ` · ${deltaText(metricOf(metrics, "active_users"))}`}
        </p>
      </div>
    </div>
  );
}

export function MetricsSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [nps, setNps] = useState<string>("");
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const saveMetric = useMutation({
    mutationFn: updateMetric,
    onSuccess: () => {
      toast.success("KPI mis à jour");
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });
  const npsMetric = metricOf(metrics.data, "nps");

  return (
    <section className="col-span-12 md:col-span-5 bg-surface-container-lowest border border-outline-variant p-md flex flex-col">
      <div className="flex items-center justify-between mb-md">
        <h2 className="font-headline-sm text-headline-sm text-primary">Indicateurs</h2>
        {isAdmin && <Icon name="settings" className="text-on-surface-variant cursor-pointer" />}
      </div>
      <MetricTiles metrics={metrics.data} />
      {isAdmin && <div className="space-y-xs">
        <label className="font-label-sm text-label-sm text-on-surface-variant block">
          MODIFIER LE NPS CANDIDATS
        </label>
        <div className="flex gap-xs">
          <input
            className="flex-grow bg-card border border-outline-variant p-xs font-label-md focus:outline-none focus:border-primary"
            type="number"
            value={nps !== "" ? nps : (npsMetric?.value ?? "")}
            onChange={(e) => setNps(e.target.value)}
          />
          <button
            onClick={() =>
              saveMetric.mutate({
                key: "nps",
                value: Number(nps !== "" ? nps : (npsMetric?.value ?? 0)),
              })
            }
            disabled={saveMetric.isPending}
            className="bg-primary text-on-primary px-sm font-label-md text-label-md disabled:opacity-50"
          >
            METTRE À JOUR
          </button>
        </div>
        <p className="text-[10px] text-on-surface-variant italic">
          {npsMetric
            ? `Tendance : ${trendText(npsMetric)}${
                deltaText(npsMetric) ? ` · ${deltaText(npsMetric)}` : ""
              }`
            : "Mis à jour à partir des retours candidats."}
        </p>
      </div>}
      <div className="mt-auto pt-md">
        <img
          src={PERF_IMAGE}
           alt="Graphiques minimalistes à barres et à lignes dans un tableau de bord anthracite et blanc"
          loading="lazy"
          className="w-full h-24 object-cover border border-outline-variant"
        />
      </div>
    </section>
  );
}
