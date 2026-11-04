import { createFileRoute } from "@tanstack/react-router";
import { BlockersAdminPanel } from "@/components/manage/blockers-admin";

export const Route = createFileRoute("/_authenticated/manage/blockers")({
  head: () => ({
    meta: [
      { title: "Gestion des points bloquants — Happy Place" },
      { name: "description", content: "Créez, modifiez et supprimez les points bloquants dans Happy Place." },
      { property: "og:title", content: "Gestion des points bloquants — Happy Place" },
      { property: "og:description", content: "Gérez les alertes opérationnelles des missions de recrutement dans Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageBlockers,
});

function ManageBlockers() {
  return <BlockersAdminPanel />;
}
