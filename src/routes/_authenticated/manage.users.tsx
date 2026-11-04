import { createFileRoute } from "@tanstack/react-router";
import { TeamsAdminPanel } from "@/components/manage/teams-admin";
import { AttachmentQueueBanner, UsersAdminPanel } from "@/components/manage/users-admin";

export const Route = createFileRoute("/_authenticated/manage/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs autorisés — Happy Place" },
      { name: "description", content: "Liste blanche des comptes Google autorisés à se connecter." },
      { property: "og:title", content: "Utilisateurs autorisés — Happy Place" },
      { property: "og:description", content: "Gérer qui peut accéder à Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { email: me } = Route.useRouteContext();
  return (
    <div className="space-y-md">
      <AttachmentQueueBanner />
      <TeamsAdminPanel />
      <UsersAdminPanel me={me} showQueueBanner={false} />
    </div>
  );
}
