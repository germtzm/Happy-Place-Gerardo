import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchOwnRole, signOut } from "@/lib/auth";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";

// Écran d'attente : le compte existe mais n'est pas (encore) dans la liste blanche.
// Un admin doit l'ajouter ; une fois fait, le prochain chargement mène au dashboard.

export const Route = createFileRoute("/choisir-role")({
  ssr: false,
  head: () => ({ meta: [{ title: "Compte en attente — Happy Place" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const email = data.user.email ?? "";
    const role = email ? await fetchOwnRole(email).catch(() => null) : null;
    if (role) throw redirect({ to: "/" });
    return { email };
  },
  component: EnAttentePage,
});

function EnAttentePage() {
  const { email } = Route.useRouteContext();

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <div className="space-y-xs">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Première connexion
            </p>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Compte en attente d'activation
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {email ? `Ton compte (${email}) est créé` : "Ton compte est créé"}, mais il n'a pas
              encore accès à Happy Place. Un admin doit t'ajouter. Reviens ici dès que c'est fait.
            </p>
          </div>
          <Button
            type="button"
            onClick={signOut}
            className="mt-md h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary"
          >
            SE DÉCONNECTER
          </Button>
        </section>
      </main>
    </div>
  );
}
