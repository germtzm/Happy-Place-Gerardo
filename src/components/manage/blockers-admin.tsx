import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CardActionButton } from "@/components/home/card-action-button";
import { Icon } from "@/components/home/icon";
import { TeamFilter } from "@/components/home/team-filter";
import { useTeamFilter } from "@/components/home/use-team-filter";
import {
  ConfirmDelete,
  ErrorSummary,
  Field,
  FormActions,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/manage/crud-ui";
import { TeamCheckboxes } from "@/components/manage/team-checkboxes";
import { filterByTeam } from "@/lib/home-lists";
import { blockerSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import {
  createBlocker,
  deleteBlocker,
  fetchAllBlockers,
  fetchSelectableTeams,
  timeAgo,
  updateBlocker,
  TeamLinkError,
  type Blocker,
  type BlockerInput,
} from "@/lib/dashboard";

const severityLabels: Record<string, string> = {
  critical: "Critique",
  warning: "Avertissement",
  info: "Information",
};

const empty: BlockerInput = {
  title: "",
  description: "",
  department: "",
  severity: "warning",
  status: "EN COURS",
};

/**
 * Corps de la page /manage/blockers, aussi affiché dans l'accueil de l'admin. La liste reprend la carte de
 * l'accueil. `onOpenArchive` ajoute « VOIR L'ARCHIVE » ; `teamFilter` ajoute le sélecteur d'équipe de
 * l'accueil au-dessus de la liste. Ni l'un ni l'autre n'existe sur la page /manage.
 */
export function BlockersAdminPanel({
  onOpenArchive,
  teamFilter = false,
}: {
  onOpenArchive?: () => void;
  teamFilter?: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<BlockerInput | null>(null);
  const [editing, setEditing] = useState<Blocker | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toDelete, setToDelete] = useState<Blocker | null>(null);
  const [formTeams, setFormTeams] = useState<string[]>([]);
  const [team] = useTeamFilter();

  const list = useQuery({ queryKey: ["blockers", "all"], queryFn: fetchAllBlockers, retry: false });
  const items = teamFilter ? filterByTeam(list.data ?? [], team) : (list.data ?? []);
  const teamsQuery = useQuery({
    queryKey: ["teams", "selectable"],
    queryFn: fetchSelectableTeams,
    retry: false,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["blockers"] });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const save = useMutation({
    mutationFn: (v: { input: BlockerInput; teams: string[] }) =>
      editing ? updateBlocker(editing.id, v.input, v.teams) : createBlocker(v.input, v.teams),
    onSuccess: () => {
      toast.success(editing ? "Point bloquant modifié" : "Point bloquant créé");
      close();
      invalidate();
    },
    onError: (e: unknown) => {
      onError(e);
      // Le point est enregistré mais pas ses équipes : on recharge la liste, et à la création on ferme
      // la fenêtre pour éviter un doublon (le point se rouvre depuis la liste pour corriger les équipes).
      if (e instanceof TeamLinkError) {
        invalidate();
        if (!editing) close();
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBlocker(id),
    onSuccess: () => {
      toast.success("Point bloquant supprimé");
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  function close() {
    setForm(null);
    setEditing(null);
    setErrors({});
    setFormTeams([]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const res = validate(blockerSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    save.mutate({ input: res.data, teams: formTeams });
  }

  function openEdit(b: Blocker) {
    setEditing(b);
    setErrors({});
    setFormTeams(b.teams);
    setForm({
      title: b.title,
      description: b.description ?? "",
      department: b.department,
      severity: b.severity,
      status: b.status,
    });
  }

  return (
    <section className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          Points bloquants ({list.data?.length ?? 0})
        </h2>
        <div className="flex flex-wrap items-center gap-sm">
          {onOpenArchive && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onOpenArchive()}
              className="flex min-h-[44px] items-center border border-outline bg-surface px-md py-xs font-label-md text-label-md text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              VOIR L'ARCHIVE
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setErrors({});
              setFormTeams([]);
              setForm({ ...empty });
            }}
            className="flex min-h-[44px] items-center justify-center border border-transparent px-md py-xs bg-primary text-on-primary font-label-md text-label-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            + NOUVEAU POINT BLOQUANT
          </button>
        </div>
      </div>

      {teamFilter && <TeamFilter />}

      {list.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {list.isError && (
        <p className="text-body-sm text-error">Impossible de charger les points bloquants.</p>
      )}

      <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-sm xl:grid-cols-2">
        {items.map((b) => {
          const critical = b.severity === "critical";
          return (
            <div
              key={b.id}
              className={`${critical ? "accent-bar " : ""}flex min-h-28 min-w-0 flex-col gap-sm overflow-hidden rounded-[8px] border border-outline-variant bg-card p-sm sm:flex-row sm:items-stretch sm:justify-between`}
            >
              <div className="flex min-w-0 flex-1 gap-md">
                <Icon
                  name={critical ? "error" : "warning"}
                  className={
                    critical
                      ? "text-error mt-1 [font-variation-settings:'FILL'_1]"
                      : "text-secondary mt-1"
                  }
                />
                <div className="min-w-0">
                  <p className="font-body-md text-primary font-bold wrap-anywhere">
                    {b.title}
                    <span className="sr-only"> ({severityLabels[b.severity] ?? b.severity})</span>
                  </p>
                  <p className="line-clamp-3 text-body-sm text-on-surface-variant wrap-anywhere">
                    {b.description}
                  </p>
                  <div className="mt-xs flex flex-wrap items-center gap-sm">
                    <span className="text-[11px] font-label-sm bg-surface-container-highest px-xs py-0.5">
                      {b.department}
                    </span>
                    <span
                      className={`text-[11px] font-label-sm ${critical ? "text-error" : "text-on-surface-variant"}`}
                    >
                      {b.status}
                    </span>
                    <span className="text-[11px] font-label-sm text-on-surface-variant">
                      Mis à jour {timeAgo(b.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-2 sm:items-end">
                <CardActionButton
                  variant="white"
                  aria-haspopup="dialog"
                  aria-label={`Modifier le point bloquant : ${b.title}`}
                  onClick={() => openEdit(b)}
                >
                  Modifier
                </CardActionButton>
                <CardActionButton
                  variant="delete"
                  aria-haspopup="dialog"
                  aria-label={`Supprimer le point bloquant : ${b.title}`}
                  onClick={() => setToDelete(b)}
                >
                  Supprimer
                </CardActionButton>
              </div>
            </div>
          );
        })}
        {list.data && items.length === 0 && (
          <p className="col-span-full text-body-sm italic text-on-surface-variant">
            Aucun point bloquant.
          </p>
        )}
      </div>

      {form && (
        <Modal
          title={editing ? "Modifier le point bloquant" : "Nouveau point bloquant"}
          onClose={close}
        >
          <form onSubmit={submit} className="space-y-sm" noValidate>
            <ErrorSummary errors={errors} />
            <Field label="Titre" error={errors.title}>
              <TextInput
                value={form.title}
                maxLength={160}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Description" error={errors.description}>
              <TextArea
                rows={4}
                value={form.description}
                maxLength={2000}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Pôle concerné" error={errors.department}>
              <TextInput
                value={form.department}
                maxLength={60}
                placeholder="Ex. Data & IA"
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </Field>
            <TeamCheckboxes
              teams={teamsQuery.data}
              value={formTeams}
              onChange={setFormTeams}
              loading={teamsQuery.isLoading}
              failed={teamsQuery.isError}
            />
            <Field label="Sévérité" error={errors.severity}>
              <Select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="critical">Critique</option>
                <option value="warning">Avertissement</option>
                <option value="info">Information</option>
              </Select>
            </Field>
            <Field label="Statut" error={errors.status}>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="OUVERT">OUVERT</option>
                <option value="EN COURS">EN COURS</option>
                <option value="SURVEILLANCE">SURVEILLANCE</option>
                {editing && (
                  <option
                    value="RÉSOLU"
                    disabled={form.status === "OUVERT"}
                    title={form.status === "OUVERT" ? "Passe d'abord par EN COURS" : undefined}
                  >
                    RÉSOLU
                  </option>
                )}
              </Select>
            </Field>
            <FormActions pending={save.isPending} onCancel={close} />
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          label={toDelete.title}
          pending={remove.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete.id)}
        />
      )}
    </section>
  );
}
