import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BulkImport } from "@/components/manage/bulk-import";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { countAttachmentDeletionQueue, processAttachmentDeletionQueue } from "@/lib/dashboard";

export type AppRole = "admin" | "manager" | "collaborateur";
export type Row = {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
  teams: string[];
  team: string | null;
  departure_date: string | null;
  first_name: string | null;
  last_name: string | null;
};
const nameSchema = z.string().trim().max(100, "100 caractères maximum");
const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide").max(255);
export const teamSchema = z.string().trim().min(2, "Nom d'équipe trop court").max(60, "60 caractères maximum");
const MIN_TEAM_MESSAGE = "Un manager doit garder au moins une équipe.";

/** Liste blanche avec rôles et équipes : même clé de requête pour les deux panneaux (React Query la partage). */
export function useAllowedUsers() {
  return useQuery({
    queryKey: ["allowed_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("id, email, first_name, last_name, team, departure_date, created_at, allowed_user_roles(role), manager_teams(team)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        team: user.team,
        departure_date: user.departure_date,
        role: user.allowed_user_roles?.role ?? "collaborateur",
        teams: user.manager_teams.map((entry) => entry.team).sort(),
      })) as Row[];
    },
  });
}

export function useTeamsList() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("name, is_reserved");
      if (error) throw error;
      return (data ?? []).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    },
  });
}

/** Bandeau « N document(s) en attente de suppression » avec son bouton Réessayer (haut de /manage/users). */
export function AttachmentQueueBanner() {
  const qc = useQueryClient();
  const onError = (e: unknown) => toast.error((e as Error).message);
  const queue = useQuery({
    queryKey: ["attachment_deletion_queue"],
    queryFn: countAttachmentDeletionQueue,
  });
  const retry = useMutation({
    mutationFn: processAttachmentDeletionQueue,
    onSuccess: (r) => {
      if (r.remaining > 0) toast.error(`${r.remaining} document(s) n'ont pas pu être supprimés.`);
      else toast.success(`${r.deleted} document(s) supprimé(s)`);
    },
    onError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["attachment_deletion_queue"] }),
  });
  if ((queue.data ?? 0) <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-sm border border-error bg-surface-container-lowest p-sm">
      <p className="text-body-sm text-error">{queue.data} document(s) en attente de suppression</p>
      <button
        type="button"
        onClick={() => retry.mutate()}
        disabled={retry.isPending}
        className="px-md py-xs border border-outline text-primary font-label-md text-label-md hover:bg-surface-container disabled:opacity-50"
      >
        {retry.isPending ? "…" : "Réessayer"}
      </button>
    </div>
  );
}

/**
 * Gestion d'utilisateurs : import .xlsx, formulaire d'ajout, liste, droits et départs programmés. Corps de
 * /manage/users sans la section Équipes. `me` est l'e-mail du connecté. `showQueueBanner` à faux quand la
 * page affiche déjà le bandeau en tête (/manage/users).
 */
export function UsersAdminPanel({ me, showQueueBanner = true }: { me: string; showQueueBanner?: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AppRole>("collaborateur");
  const [newTeam, setNewTeam] = useState("");
  const [memberTeams, setMemberTeams] = useState<Record<string, string>>({});
  const [teamInputs, setTeamInputs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const list = useAllowedUsers();
  const teamsQuery = useTeamsList();
  const selectableTeams = (teamsQuery.data ?? []).filter((t) => !t.is_reserved && t.name.toLowerCase() !== "admin").map((t) => t.name);
  const [roleDialog, setRoleDialog] = useState<{ id: string; email: string; team: string } | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["allowed_users"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
  };
  const onError = (e: unknown) => toast.error((e as Error).message);

  const add = useMutation({
    mutationFn: async (v: { email: string; role: AppRole; team: string | null; first_name: string | null; last_name: string | null }) => {
      const { data, error } = await supabase
        .from("allowed_users")
        .insert({ email: v.email, team: v.team, first_name: v.first_name, last_name: v.last_name })
        .select("id")
        .single();
      if (error) throw new Error(error.code === "23505" ? "Cet email est déjà dans la liste" : error.message);
      const { error: roleError } = await supabase
        .from("allowed_user_roles")
        .insert({ allowed_user_id: data.id, role: v.role });
      if (roleError) {
        await supabase.from("allowed_users").delete().eq("id", data.id);
        throw roleError;
      }
    },
    onSuccess: () => { setEmail(""); setNewTeam(""); setFirstName(""); setLastName(""); toast.success("Utilisateur ajouté"); refresh(); },
    onError,
  });
  const update = useMutation({
    mutationFn: async (v: { id: string; role: AppRole; team?: string; first_name?: string | null; last_name?: string | null }) => {
      if (v.role === "manager" && (!v.first_name?.trim() || !v.last_name?.trim())) {
        throw new Error("Renseigne d'abord le prénom et le nom de ce compte avant de le passer manager.");
      }
      if (v.role === "collaborateur") {
        const parsed = teamSchema.safeParse(v.team ?? "");
        if (!parsed.success) throw new Error("Équipe requise pour un collaborateur : " + parsed.error.issues[0].message);
        const { data, error: tErr } = await supabase.from("allowed_users").update({ team: parsed.data }).eq("id", v.id).select("id");
        if (tErr) throw tErr;
        if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      } else {
        const { data, error: tErr } = await supabase.from("allowed_users").update({ team: null }).eq("id", v.id).select("id");
        if (tErr) throw tErr;
        if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      }
      const { data: roleRows, error } = await supabase
        .from("allowed_user_roles")
        .update({ role: v.role, updated_at: new Date().toISOString() })
        .eq("allowed_user_id", v.id)
        .select("id");
      if (error) throw error;
      if (!roleRows?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      if (v.role !== "manager") {
        const { error: teamError } = await supabase.from("manager_teams").delete().eq("allowed_user_id", v.id);
        if (teamError) throw teamError;
      }
    },
    onSuccess: refresh,
    onError,
  });
  const setDeparture = useMutation({
    mutationFn: async (v: { id: string; date: string | null }) => {
      const { error } = await supabase.from("allowed_users").update({ departure_date: v.date }).eq("id", v.id);
      if (error) throw error;
      return v.date;
    },
    onSuccess: (d) => { toast.success(d ? `Départ programmé le ${formatDate(d)}` : "Départ annulé"); refresh(); },
    onError,
  });
  const formatDate = (iso: string) => iso.split("-").reverse().join("/");
  const minDeparture = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const scheduleRemoval = (u: Row) => {
    if (u.departure_date && u.departure_date <= minDeparture) {
      toast.info(`Départ déjà programmé le ${formatDate(u.departure_date)}`);
      return;
    }
    if (
      confirm(
        `Retirer l'accès de ${u.email} ? Son accès sera supprimé le ${formatDate(minDeparture)}, dans 7 jours. Son manager et les admins sont prévenus dès maintenant et pourront télécharger ses documents d'ici là. Tu peux annuler avec « Annuler le départ ».`,
      )
    )
      setDeparture.mutate({ id: u.id, date: minDeparture });
  };
  const [departureInputs, setDepartureInputs] = useState<Record<string, string>>({});

  const addTeam = useMutation({
    mutationFn: async (v: { allowedUserId: string; team: string }) => {
      const parsed = teamSchema.safeParse(v.team);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (parsed.data.trim().toLowerCase() === "admin") throw new Error("L'équipe Admin est réservée aux admins.");
      const { data, error } = await supabase
        .from("manager_teams")
        .insert({ allowed_user_id: v.allowedUserId, team: parsed.data })
        .select("id");
      if (!error && !data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
      if (error)
        throw new Error(
          error.code === "23514"
            ? "L'équipe Admin est réservée aux admins."
            : error.code === "23505"
            ? `Ce manager a déjà l'équipe « ${parsed.data} ».`
            : error.message,
        );
    },
    onSuccess: (_, variables) => {
      setTeamInputs((current) => ({ ...current, [variables.allowedUserId]: "" }));
      toast.success("Équipe attribuée");
      refresh();
    },
    onError,
  });

  const removeTeam = useMutation({
    mutationFn: async (v: { allowedUserId: string; team: string }) => {
      const { data, error } = await supabase
        .from("manager_teams")
        .delete()
        .eq("allowed_user_id", v.allowedUserId)
        .eq("team", v.team)
        .select("id");
      if (error) {
        throw new Error(
          error.message.includes("garder au moins une équipe") ? MIN_TEAM_MESSAGE : error.message,
        );
      }
      if (!data?.length) throw new Error("Modification refusée : vérifie que tu es admin");
    },
    onSuccess: () => { toast.success("Équipe retirée"); refresh(); },
    onError,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setErr(parsed.error.issues[0].message);
    let team: string | null = null;
    if (role === "collaborateur") {
      const t = teamSchema.safeParse(newTeam);
      if (!t.success) return setErr("Équipe requise : " + t.error.issues[0].message);
      team = t.data;
    }
    const fn = nameSchema.safeParse(firstName);
    if (!fn.success) return setErr("Prénom : " + fn.error.issues[0].message);
    if (!fn.data) return setErr("Prénom requis");
    const ln = nameSchema.safeParse(lastName);
    if (!ln.success) return setErr("Nom : " + ln.error.issues[0].message);
    if (!ln.data) return setErr("Nom requis");
    setErr(null);
    add.mutate({ email: parsed.data, role, team, first_name: fn.data || null, last_name: ln.data || null });
  }

  return (
    <div className="space-y-md">
      {showQueueBanner && <AttachmentQueueBanner />}
      <BulkImport onImported={refresh} />
      <form onSubmit={submit} className="flex flex-col md:flex-row gap-xs md:items-start bg-surface-container-lowest border border-outline-variant p-md">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Prénom (obligatoire)"
          aria-label="Prénom"
          maxLength={100}
          className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Nom (obligatoire)"
          aria-label="Nom"
          maxLength={100}
          className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
        />
        <div className="flex-1">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@gmail.com"
            aria-label="Email Google"
            className="w-full border border-outline-variant bg-surface px-sm py-xs font-body-md"
          />
          {err && <p className="text-error text-sm mt-1">{err}</p>}
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Row["role"])}
          aria-label="Rôle"
          className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
        >
          <option value="collaborateur">Collaborateur</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        {role === "collaborateur" && (
<select
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            aria-label="Équipe du collaborateur"
            className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
          >
            <option value="">Choisir une équipe</option>
            {selectableTeams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button disabled={add.isPending} className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md">
          AJOUTER
        </button>
      </form>

      <div className="border border-outline-variant divide-y divide-outline-variant bg-surface-container-lowest">
        {list.data?.map((u) => (
          <div key={u.id} className="space-y-sm p-sm">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <span className="font-body-md text-primary">
                {(u.first_name || u.last_name) && <span className="mr-xs">{[u.first_name, u.last_name].filter(Boolean).join(" ")} ·</span>}
                {u.email}{u.email === me && " (toi)"}
                {u.departure_date && (
                  <span className="ml-xs px-xs py-[1px] border border-error text-error font-label-sm text-label-sm">
                    Part le {u.departure_date.split("-").reverse().join("/")}
                  </span>
                )}
              </span>
              <div className="flex gap-xs">
              <select
                value={u.role}
                onChange={(e) => {
                  const next = e.target.value as AppRole;
                  if (next === "collaborateur") {
                    setRoleDialog({ id: u.id, email: u.email, team: u.team ?? "" });
                  } else update.mutate({ id: u.id, role: next, first_name: u.first_name, last_name: u.last_name }, { onSuccess: () => toast.success("Rôle modifié") });
                }}
                aria-label={`Rôle de ${u.email}`}
                className="border border-outline-variant bg-surface px-sm py-xs font-body-md"
              >
                <option value="collaborateur">Collaborateur</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => scheduleRemoval(u)}
                disabled={u.email === me || setDeparture.isPending}
                title={u.email === me ? "Tu ne peux pas programmer ton propre départ" : undefined}
                className="px-sm py-xs border border-outline text-error font-label-md text-label-md disabled:opacity-50"
              >
                RETIRER (J+7)
              </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-xs border-t border-outline-variant pt-sm">
              <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor={`dep-${u.id}`}>
                Départ prévu le
              </label>
              <input
                id={`dep-${u.id}`}
                type="date"
                min={minDeparture}
                value={departureInputs[u.id] ?? u.departure_date ?? ""}
                onChange={(e) => setDepartureInputs((c) => ({ ...c, [u.id]: e.target.value }))}
                className="border border-outline-variant bg-surface px-sm py-1 font-body-md"
              />
              <button
                type="button"
                disabled={setDeparture.isPending || !(departureInputs[u.id] ?? u.departure_date)}
                onClick={() => setDeparture.mutate({ id: u.id, date: departureInputs[u.id] ?? u.departure_date ?? null })}
                className="bg-primary text-on-primary px-sm py-1 font-label-sm text-label-sm disabled:opacity-50"
              >
                Enregistrer
              </button>
              {u.departure_date && (
                <button
                  type="button"
                  disabled={setDeparture.isPending}
                  onClick={() => {
                    setDepartureInputs((c) => ({ ...c, [u.id]: "" }));
                    setDeparture.mutate({ id: u.id, date: null });
                  }}
                  className="px-sm py-1 border border-outline text-primary font-label-sm text-label-sm"
                >
                  Annuler le départ
                </button>
              )}
            </div>
            {u.role === "collaborateur" && (
              <div className="flex flex-wrap items-center gap-xs border-t border-outline-variant pt-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">ÉQUIPE :</span>
<select
            value={memberTeams[u.id] ?? u.team ?? ""}
            onChange={(e) => setMemberTeams((c) => ({ ...c, [u.id]: e.target.value }))}
            aria-label={`Équipe de ${u.email}`}
            className="border border-outline-variant bg-surface px-sm py-1 font-body-md"
          >
            <option value="">Choisir une équipe</option>
            {(u.team && !selectableTeams.includes(u.team) ? [u.team, ...selectableTeams] : selectableTeams).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
                {(() => {
                  const chosen = memberTeams[u.id] ?? u.team ?? "";
                  const saving = update.isPending && update.variables?.id === u.id;
                  return (
                    <button
                      type="button"
                      disabled={!chosen || chosen === u.team || saving}
                      onClick={() =>
                        update.mutate(
                          { id: u.id, role: "collaborateur", team: chosen },
                          {
                            onSuccess: () => {
                              toast.success("Équipe modifiée");
                              setMemberTeams((c) => { const n = { ...c }; delete n[u.id]; return n; });
                            },
                          },
                        )
                      }
                      className="bg-primary text-on-primary px-sm py-1 font-label-sm text-label-sm disabled:opacity-50"
                    >
                      {saving ? "…" : "ENREGISTRER"}
                    </button>
                  );
                })()}
                {!u.team && <span className="text-error text-sm">Aucune équipe définie</span>}
              </div>
            )}
            {u.role === "manager" && (
              <div className="flex flex-wrap items-center gap-xs border-t border-outline-variant pt-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">ÉQUIPES :</span>
                {u.teams.map((team) => (
                  <button
                    key={team}
                    type="button"
                    title={u.teams.length <= 1 ? MIN_TEAM_MESSAGE : `Retirer l'équipe ${team}`}
                    disabled={u.teams.length <= 1}
                    aria-describedby={u.teams.length === 1 ? `last-team-${u.id}` : undefined}
                    onClick={() => removeTeam.mutate({ allowedUserId: u.id, team })}
                    className="border border-outline-variant bg-surface px-xs py-1 font-label-sm text-label-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {team} ×
                  </button>
                ))}
                {u.teams.length === 1 && (
                  <span
                    id={`last-team-${u.id}`}
                    className="w-full text-body-sm text-on-surface-variant"
                  >
                    {MIN_TEAM_MESSAGE}
                  </span>
                )}
                {u.teams.length === 0 && (
                  <span className="w-full font-label-sm text-label-sm text-error">
                    <span aria-hidden="true">⚠ </span>
                    Attention : ce manager n'a aucune équipe. Attribue-lui en au moins une.
                  </span>
                )}
<select
            value={teamInputs[u.id] ?? ""}
            onChange={(e) => setTeamInputs((current) => ({ ...current, [u.id]: e.target.value }))}
            aria-label={`Ajouter une équipe à ${u.email}`}
            className="border border-outline-variant bg-surface px-sm py-1 font-body-md"
          >
            <option value="">Choisir une équipe</option>
            {selectableTeams.filter((t) => !u.teams.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
                <button
                  type="button"
                  disabled={!teamInputs[u.id] || addTeam.isPending}
                  onClick={() => addTeam.mutate({ allowedUserId: u.id, team: teamInputs[u.id] ?? "" })}
                  className="bg-primary text-on-primary px-sm py-1 font-label-sm text-label-sm disabled:opacity-50"
                >
                  {addTeam.isPending && addTeam.variables?.allowedUserId === u.id ? "…" : "AJOUTER"}
                </button>
              </div>
            )}
          </div>
        ))}
        {list.isLoading && <p className="p-sm">Chargement…</p>}
      </div>
      <Dialog open={!!roleDialog} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Équipe de {roleDialog?.email}</DialogTitle>
          </DialogHeader>
          <select
            value={roleDialog?.team ?? ""}
            onChange={(e) => roleDialog && setRoleDialog({ ...roleDialog, team: e.target.value })}
            aria-label="Équipe du collaborateur"
            className="w-full border border-outline-variant bg-surface px-sm py-xs font-body-md"
          >
            <option value="">Choisir une équipe</option>
            {selectableTeams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <DialogFooter>
            <button type="button" onClick={() => setRoleDialog(null)} className="px-md py-xs border border-outline text-primary font-label-md text-label-md">Annuler</button>
            <button
              type="button"
              disabled={!roleDialog?.team || update.isPending}
              title={!roleDialog?.team ? "Choisis d'abord une équipe" : undefined}
              onClick={() => {
                if (!roleDialog?.team) return;
                update.mutate(
                  { id: roleDialog.id, role: "collaborateur", team: roleDialog.team },
                  { onSuccess: () => { toast.success("Rôle modifié"); setRoleDialog(null); } },
                );
              }}
              className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50"
            >
              {update.isPending ? "…" : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
