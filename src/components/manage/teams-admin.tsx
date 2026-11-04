import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { teamSchema, useAllowedUsers, useTeamsList } from "@/components/manage/users-admin";

/**
 * Gestion d'équipes : créer, renommer, supprimer, avec le nombre de personnes par équipe. Section Équipes
 * de /manage/users, aussi affichée dans l'accueil de l'admin. Lit ses données elle-même.
 */
export function TeamsAdminPanel() {
  const qc = useQueryClient();
  const users = useAllowedUsers().data ?? [];
  const teams = useTeamsList().data ?? [];
  const onChanged = () => {
    qc.invalidateQueries({ queryKey: ["allowed_users"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
  };
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const count = (t: string) =>
    users.filter((u) => (u.role === "collaborateur" && u.team === t) || (u.role === "manager" && u.teams.includes(t))).length;
  const onError = (e: unknown) => toast.error((e as Error).message);

  const create = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("teams").insert({ name: n });
      if (error) throw new Error(error.code === "23505" ? "Cette équipe existe déjà" : error.message);
    },
    onSuccess: () => { setName(""); toast.success("Équipe ajoutée"); onChanged(); },
    onError: (e) => setErr((e as Error).message),
  });
  const rename = useMutation({
    mutationFn: async (v: { from: string; to: string }) => {
      const { error } = await supabase.from("teams").update({ name: v.to }).eq("name", v.from);
      if (error) throw new Error(error.code === "23505" ? "Cette équipe existe déjà" : error.message);
    },
    onSuccess: () => { setEditing(null); toast.success("Équipe renommée"); onChanged(); },
    onError,
  });
  const del = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("teams").delete().eq("name", n);
      if (error)
        throw new Error(error.code === "23503" ? "Impossible : cette équipe est encore utilisée (personnes ou demandes). Réaffecte-les d'abord." : error.message);
    },
    onSuccess: () => { toast.success("Équipe supprimée"); onChanged(); },
    onError,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = teamSchema.safeParse(name);
    if (!p.success) return setErr(p.error.issues[0].message);
    setErr(null);
    create.mutate(p.data);
  }
  const btn = "px-sm py-1 border border-outline text-primary font-label-sm text-label-sm disabled:opacity-50";

  return (
    <section className="space-y-sm bg-surface-container-lowest border border-outline-variant p-md">
      <h2 className="font-label-md text-label-md text-primary">Équipes</h2>
      <form onSubmit={submit} className="flex flex-wrap items-start gap-xs">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nouvelle équipe"
            aria-label="Nouvelle équipe"
            maxLength={60}
            className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
          />
          {err && <p className="text-error text-sm mt-1">{err}</p>}
        </div>
        <button disabled={create.isPending} className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md">AJOUTER</button>
      </form>
      <ul className="divide-y divide-outline-variant border border-outline-variant">
        {teams.map((t) => (
          <li key={t.name} className="flex flex-wrap items-center justify-between gap-xs p-xs">
            {editing?.from === t.name ? (
              <span className="flex flex-wrap gap-xs">
                <input
                  value={editing.to}
                  onChange={(e) => setEditing({ ...editing, to: e.target.value })}
                  aria-label={`Nouveau nom pour ${t.name}`}
                  maxLength={60}
                  className="border border-outline-variant bg-surface px-sm py-1 font-body-md"
                />
                <button
                  type="button"
                  className="bg-primary text-on-primary px-sm py-1 font-label-sm text-label-sm"
                  disabled={rename.isPending}
                  onClick={() => {
                    const p = teamSchema.safeParse(editing.to);
                    if (!p.success) return toast.error(p.error.issues[0].message);
                    rename.mutate({ from: t.name, to: p.data });
                  }}
                >
                  Enregistrer
                </button>
                <button type="button" className={btn} onClick={() => setEditing(null)}>Annuler</button>
              </span>
            ) : (
              <span className="font-body-md text-primary">
                {t.is_reserved && <span aria-label="Équipe réservée" title="Équipe réservée" className="mr-xs">🔒</span>}
                {t.name} <span className="text-on-surface-variant text-body-sm">· {count(t.name)} personne(s)</span>
              </span>
            )}
            {!t.is_reserved && editing?.from !== t.name && (
              <span className="flex gap-xs">
                <button type="button" className={btn} onClick={() => setEditing({ from: t.name, to: t.name })}>Renommer</button>
                <button
                  type="button"
                  className={`${btn} text-error`}
                  disabled={del.isPending}
                  onClick={() => confirm(`Supprimer l'équipe « ${t.name} » ?`) && del.mutate(t.name)}
                >
                  Supprimer
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
