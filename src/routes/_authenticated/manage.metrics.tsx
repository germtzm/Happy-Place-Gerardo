import { createFileRoute } from "@tanstack/react-router";
import { MetricsAdminPanel } from "@/components/manage/metrics-admin";

export const Route = createFileRoute("/_authenticated/manage/metrics")({
  head: () => ({
    meta: [
      { title: "Gestion des indicateurs — Happy Place" },
      { name: "description", content: "Créez, modifiez et supprimez les indicateurs de Happy Place." },
      { property: "og:title", content: "Gestion des indicateurs — Happy Place" },
      { property: "og:description", content: "Gérez les indicateurs de performance dans Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageMetrics,
});

function ManageMetrics() {
  return <MetricsAdminPanel />;
}
