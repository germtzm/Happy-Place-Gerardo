import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";

// Connexion par email + mot de passe (Supabase Auth). L'accès à l'app reste
// réservé à la liste blanche : un compte sans rôle arrive sur /choisir-role,
// qui explique qu'un admin doit l'activer.

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Happy Place" },
      { name: "description", content: "Happy Place, le dashboard interne de Bigger Boat." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function translateError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message))
    return "Confirme ton adresse email grâce au lien reçu, puis réessaie.";
  if (/already registered|already exists/i.test(message))
    return "Un compte existe déjà avec cette adresse. Connecte-toi.";
  if (/password/i.test(message) && /(least|short|weak)/i.test(message)) {
    return "Mot de passe trop faible : 8 caractères minimum.";
  }
  if (/rate limit|too many/i.test(message))
    return "Trop de tentatives. Patiente un instant puis réessaie.";
  return `Une erreur est survenue : ${message}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (err) {
        setError(translateError(err.message));
        return;
      }
      navigate({ to: "/" });
      return;
    }
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(translateError(err.message));
      return;
    }
    if (data.session) {
      navigate({ to: "/" });
      return;
    }
    setInfo("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
    setMode("signin");
    setPassword("");
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
  }

  const inputCls =
    "mt-xs h-11 w-full border border-outline-variant bg-background px-sm font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
  const labelCls = "block font-label-sm text-label-sm uppercase text-on-surface-variant";

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Happy Place</h1>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
            {mode === "signin"
              ? "Connecte-toi à ton espace."
              : "Crée ton compte. Un admin devra ensuite l'activer."}
          </p>

          {error && (
            <p
              className="mt-md border border-error bg-error-container p-sm font-body-sm text-on-error-container"
              role="alert"
            >
              {error}
            </p>
          )}
          {info && (
            <p
              className="mt-md border border-outline-variant bg-surface-container p-sm font-body-sm text-on-surface"
              role="status"
            >
              {info}
            </p>
          )}

          <form onSubmit={submit} className="mt-md space-y-md" noValidate>
            <label className={labelCls}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 8 : undefined}
                className={inputCls}
              />
            </label>
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary"
            >
              {busy ? "PATIENTE…" : mode === "signin" ? "SE CONNECTER" : "CRÉER MON COMPTE"}
            </Button>
          </form>

          <p className="mt-md font-body-sm text-body-sm text-on-surface-variant">
            {mode === "signin" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <button
              type="button"
              onClick={switchMode}
              className="text-primary underline-offset-2 hover:underline"
            >
              {mode === "signin" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
