import { createFileRoute } from "@tanstack/react-router";
import { NewsAdminPanel } from "@/components/manage/news-admin";

export const Route = createFileRoute("/_authenticated/manage/news")({
  head: () => ({
    meta: [
      { title: "Gestion des actualités — Happy Place" },
      { name: "description", content: "Créez, modifiez et supprimez les actualités de Happy Place." },
      { property: "og:title", content: "Gestion des actualités — Happy Place" },
      { property: "og:description", content: "Gérez les actualités du cabinet de recrutement dans Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageNews,
});

function ManageNews() {
  return <NewsAdminPanel />;
}
