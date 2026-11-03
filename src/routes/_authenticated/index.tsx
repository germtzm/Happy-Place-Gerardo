import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorSummary, Field, FormActions, Modal, TextArea, TextInput } from "@/components/manage/crud-ui";
import { ideaSchema, rejectionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { BrandHeader } from "@/components/brand-header";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { SubmissionReader } from "@/components/submission-reader";
import { NewsReader } from "@/components/news-reader";
import { BlockerArchive } from "@/components/dashboard-extras";
import { AdminHome } from "@/components/home/admin-home";
import { CollaborateurHome } from "@/components/home/collaborateur-home";
import { FullViewContext, type FullView } from "@/components/home/full-view-context";
import { BlockersListView, MetricsListView, NewsListView } from "@/components/home/full-views";
import { HomeHeader } from "@/components/home/home-header";
import { SubmissionActionsContext } from "@/components/home/submission-actions-context";
import { ManagerHome } from "@/components/home/manager-home";
import { NotificationsView } from "@/components/home/notifications-view";
import type { HomeProps } from "@/components/home/types";
import {
  canDecideSubmission,
  exportMyRecentSubmissions,
  fetchMyFirstName,
  REJECTION_CATEGORIES,
  type News,
  type Submission,
  reviewSubmission,
  submitIdea,
  type SubmissionInput,
  updateMySubmission,
  deleteMySubmission,
} from "@/lib/dashboard";
import { canManageOwnSubmission } from "@/lib/own-submission";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Happy Place — Actualités et vue d'ensemble" },
      {
        name: "description",
        content:
          "Pilotez les missions de recrutement IT et digital, les propositions des équipes, les alertes opérationnelles et les indicateurs du cabinet.",
      },
      { property: "og:title", content: "Happy Place — Vue d'ensemble" },
      {
        property: "og:description",
        content:
          "Suivez l'activité du cabinet, les missions de recrutement, les alertes et les indicateurs clés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagerSpace,
});

function Home(props: HomeProps) {
  if (props.role === "admin") return <AdminHome {...props} />;
  if (props.role === "manager") return <ManagerHome {...props} />;
  return <CollaborateurHome {...props} />;
}

function ManagerSpace() {
  const qc = useQueryClient();
  const { role, email, user } = Route.useRouteContext();
  const isAdmin = role === "admin";
  const canReview = role === "admin" || role === "manager";
  const myEmail = (email ?? "").toLowerCase();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const myName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    myEmail;
  const [submissionForm, setSubmissionForm] = useState<SubmissionInput | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<FieldErrors>({});
  const myTeams = useQuery({
    queryKey: ["manager_teams", "mine", email],
    enabled: role === "manager" && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_teams")
        .select("team, allowed_users!inner(email)")
        .eq("allowed_users.email", (email ?? "").toLowerCase());
      if (error) throw error;
      return (data ?? []).map((t) => t.team).sort();
    },
  });
  const myFirstName = useQuery({
    queryKey: ["my_first_name", myEmail],
    enabled: !!myEmail,
    queryFn: () => fetchMyFirstName(myEmail),
    retry: false,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reading, setReading] = useState<Submission | null>(null);
  const [readingNews, setReadingNews] = useState<News | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // Vue complète ouverte depuis les cartes de l'accueil (une seule à la fois, exclusive de Notifications).
  const [fullView, setFullView] = useState<FullView | null>(null);
  const lastFullView = useRef<FullView | null>(null);
  // Au retour d'une vue complète, le focus revient sur son lien « VOIR TOUS… ».
  useEffect(() => {
    if (lastFullView.current && !fullView) {
      document.getElementById(`see-all-${lastFullView.current}`)?.focus();
    }
    lastFullView.current = fullView;
  }, [fullView]);
  const wasNotificationsOpen = useRef(false);
  // Au retour de la vue Notifications, le focus revient sur la cloche qui réapparaît.
  useEffect(() => {
    if (wasNotificationsOpen.current && !notificationsOpen) {
      document.getElementById("notification-bell")?.focus();
    }
    wasNotificationsOpen.current = notificationsOpen;
  }, [notificationsOpen]);
  const [rejectForm, setRejectForm] = useState({ rejection_category: "", rejection_note: "" });
  const [rejectErrors, setRejectErrors] = useState<FieldErrors>({});

  const onError = (e: unknown) => toast.error((e as Error).message);

  const exportReport = useMutation({
    mutationFn: () => {
      if (!email) throw new Error("Votre adresse e-mail est indisponible.");
      return exportMyRecentSubmissions(email);
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast.info("Aucune soumission en attente ou validée sur les 30 derniers jours.");
        return;
      }
      toast.success(`${count} soumission${count > 1 ? "s" : ""} exportée${count > 1 ? "s" : ""} au format CSV.`);
    },
    onError,
  });

  const review = useMutation({
    mutationFn: reviewSubmission,
    onSuccess: (_d, vars) => {
      if (vars.status === "refusée") {
        setRejecting(null);
        toast.success("Soumission refusée");
      } else {
        setReading((r) => (r?.id === vars.id ? null : r));
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  function startReject(s: Submission) {
    setReading(null);
    setRejecting(s);
    setRejectErrors({});
    setRejectForm({ rejection_category: "", rejection_note: "" });
  }

  const submit = useMutation({
    mutationFn: (input: SubmissionInput) => submitIdea({
      author_name: input.author_name,
      team: input.team,
      content: input.content,
      hide_author: input.hide_author,
    }, attachment),
    onSuccess: () => {
      setSubmissionForm(null);
      setAttachment(null);
      setSubmissionErrors({});
      toast.success("Soumission envoyée");
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  // Modifier / supprimer sa propre demande « en attente » (la base refait tous les contrôles).
  const [editing, setEditing] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState<Submission | null>(null);
  const afterOwnChange = () => {
    qc.invalidateQueries({ queryKey: ["submissions"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const updateMine = useMutation({
    mutationFn: updateMySubmission,
    onSuccess: () => {
      closeForm();
      setReading(null);
      toast.success("Demande modifiée");
      afterOwnChange();
    },
    // La fenêtre reste ouverte : le message de la base (par exemple « déjà traitée ») s'affiche.
    onError,
  });
  const deleteMine = useMutation({
    mutationFn: deleteMySubmission,
    onSuccess: () => {
      setDeleting(null);
      setReading(null);
      toast.success("Demande supprimée");
      afterOwnChange();
    },
    onError,
  });

  function closeForm() {
    setSubmissionForm(null);
    setSubmissionErrors({});
    setEditing(null);
  }

  function startEdit(s: Submission) {
    setReading(null);
    setSubmissionErrors({});
    setEditing(s);
    setSubmissionForm({
      author_name: s.author_name,
      team: s.team,
      content: s.content,
      status: "en attente",
      hide_author: s.hide_author ?? false,
    });
  }

  // La fenêtre de lecture reste ouverte dessous : à l'annulation, le focus revient sur son bouton
  // « Supprimer » ; elle se ferme avec la confirmation en cas de succès (deleteMine.onSuccess).
  function startDelete(s: Submission) {
    setDeleting(s);
  }

  const roleLabel = role === "admin" ? "ADMIN" : role === "manager" ? "MANAGER" : "COLLABORATEUR";
  // Un manager ne décide pas de sa propre demande (la base le refuse aussi).
  const readerCanDecide =
    !!reading &&
    canReview &&
    reading.status === "en attente" &&
    canDecideSubmission({ role, email: myEmail, submission: reading });

  function sendSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionForm) return;
    if (editing) {
      // Mêmes règles de validation qu'à la création ; l'équipe n'est pas modifiable.
      const res = validate(ideaSchema, {
        ...submissionForm,
        team: editing.team,
        status: "en attente",
      });
      if (!res.ok) {
        setSubmissionErrors(res.errors);
        return;
      }
      setSubmissionErrors({});
      updateMine.mutate({
        id: editing.id,
        content: res.data.content,
        hide_author: res.data.hide_author ?? false,
      });
      return;
    }
    // Collaborators: team is set server-side from their account
    // Admin: always the « Admin » team (set server-side); manager: one of their teams
    const team = role === "collaborateur" ? "auto" : role === "admin" ? "Admin" : submissionForm.team;
    const result = validate(ideaSchema, { ...submissionForm, team, status: "en attente" });
    if (!result.ok) {
      setSubmissionErrors(result.errors);
      return;
    }
    setSubmissionErrors({});
    const firstName = myFirstName.data?.trim();
    if (!firstName) {
      setSubmissionErrors({ author_name: "Ton prénom est introuvable : contacte un administrateur." });
      return;
    }
    submit.mutate({ ...result.data, author_name: firstName });
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <BrandHeader
        email={myEmail}
        onOpenNotifications={() => {
          setFullView(null);
          setNotificationsOpen(true);
        }}
        hideBell={notificationsOpen}
      />
      <main className="flex-grow w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        {fullView === "news" && (
          <NewsListView
            isAdmin={isAdmin}
            onBack={() => setFullView(null)}
            onReadNews={setReadingNews}
          />
        )}
        {fullView === "blockers" && (
          <BlockersListView
            isAdmin={isAdmin}
            onBack={() => setFullView(null)}
            onOpenArchive={() => setArchiveOpen(true)}
          />
        )}
        {fullView === "metrics" && (
          <MetricsListView isAdmin={isAdmin} onBack={() => setFullView(null)} />
        )}
        {notificationsOpen && (
          <NotificationsView
            email={myEmail}
            role={role}
            onBack={() => setNotificationsOpen(false)}
            onReadSubmission={setReading}
          />
        )}
        {/* L'accueil reste monté (masqué) pendant la vue Notifications : l'onglet actif est conservé. */}
        <div hidden={notificationsOpen || fullView !== null} className="space-y-md">
          <HomeHeader
            email={email}
            roleLabel={roleLabel}
            isAdmin={isAdmin}
            exporting={exportReport.isPending}
            onExport={() => exportReport.mutate()}
            onSubmitIdea={() => {
              setSubmissionErrors({});
              const only = role === "manager" && myTeams.data?.length === 1 ? myTeams.data[0] : "";
              setSubmissionForm({
                author_name: "",
                team: only,
                content: "",
                status: "en attente",
                hide_author: false,
              });
            }}
          />

          <FullViewContext.Provider
            value={(v) => {
              setNotificationsOpen(false);
              setFullView(v);
            }}
          >
            <SubmissionActionsContext.Provider
              value={{ email: myEmail, onEdit: startEdit, onDelete: startDelete }}
            >
              <Home
                role={role}
                email={myEmail}
                managerTeams={myTeams.data ?? []}
                myName={myName}
                onReadNews={setReadingNews}
                onReadSubmission={setReading}
                onReject={startReject}
                onApprove={(s) => review.mutate({ id: s.id, status: "validée" })}
                onOpenArchive={() => setArchiveOpen(true)}
              />
            </SubmissionActionsContext.Provider>
          </FullViewContext.Provider>
        </div>
      </main>
      <BlockerArchive open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <NewsReader news={readingNews} onClose={() => setReadingNews(null)} />
      <SubmissionReader
        submission={reading}
        onClose={() => setReading(null)}
        onReject={readerCanDecide && reading ? () => startReject(reading) : undefined}
        onApprove={
          readerCanDecide && reading
            ? () => review.mutate({ id: reading.id, status: "validée" })
            : undefined
        }
        approving={review.isPending}
        onEdit={
          reading && canManageOwnSubmission(reading, myEmail) ? () => startEdit(reading) : undefined
        }
        onDelete={
          reading && canManageOwnSubmission(reading, myEmail)
            ? () => startDelete(reading)
            : undefined
        }
      />
      {/* Confirmation de suppression : Radix Dialog (Échap, clic extérieur, focus piégé puis rendu au
          bouton « Supprimer » qui l'a ouverte). Le titre est lié par Radix (aria-labelledby). */}
      <DialogPrimitive.Root open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50" />
          {deleting && (
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-outline bg-surface-container-lowest p-md shadow-lg focus:outline-none">
              <DialogPrimitive.Title className="border-b border-outline-variant pb-sm font-headline-sm text-headline-sm text-primary">
                Supprimer ma demande
              </DialogPrimitive.Title>
              <div className="mt-sm space-y-sm">
                <p className="max-h-48 overflow-y-auto border border-outline-variant bg-surface-container-low p-xs text-body-sm italic text-on-surface-variant whitespace-pre-line wrap-anywhere">
                  “{deleting.content}”
                </p>
                <DialogPrimitive.Description className="text-body-md text-on-surface">
                  Cette demande et sa pièce jointe seront supprimées. Cette action est définitive.
                </DialogPrimitive.Description>
                <div className="flex flex-wrap justify-end gap-xs">
                  <DialogPrimitive.Close className="min-h-[44px] border border-outline px-md font-label-md text-label-md uppercase text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Annuler
                  </DialogPrimitive.Close>
                  <button
                    type="button"
                    disabled={deleteMine.isPending}
                    onClick={() => deleteMine.mutate(deleting.id)}
                    className="min-h-[44px] bg-error px-md font-label-md text-label-md uppercase text-white hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Supprimer définitivement
                  </button>
                </div>
              </div>
            </DialogPrimitive.Content>
          )}
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {rejecting && (
        <Modal title="Refuser la soumission" onClose={() => setRejecting(null)}>
          <form
            noValidate
            className="space-y-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const res = validate(rejectionSchema, rejectForm);
              if (!res.ok) return setRejectErrors(res.errors);
              setRejectErrors({});
              review.mutate({ id: rejecting.id, status: "refusée", ...res.data });
            }}
          >
            <p className="max-h-48 overflow-y-auto border border-outline-variant bg-surface-container-low p-xs text-body-sm italic text-on-surface-variant whitespace-pre-line wrap-anywhere">“{rejecting.content}”</p>
            <ErrorSummary errors={rejectErrors} />
            <Field label="Motif du refus" error={rejectErrors.rejection_category}>
              <select
                className="w-full border border-outline-variant bg-card p-xs text-body-sm"
                value={rejectForm.rejection_category}
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_category: e.target.value })}
              >
                <option value="">— Choisir un motif —</option>
                {REJECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Raison du refus (obligatoire)" error={rejectErrors.rejection_note}>
              <TextArea
                rows={4}
                value={rejectForm.rejection_note}
                placeholder="Explique au collaborateur pourquoi sa soumission est refusée…"
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_note: e.target.value })}
              />
              <CharCounter value={rejectForm.rejection_note} max={500} />
            </Field>
            <FormActions pending={review.isPending} onCancel={() => setRejecting(null)} />
          </form>
        </Modal>
      )}
      {submissionForm && (
        <Modal
          title={editing ? "Modifier ma proposition" : "Soumettre une proposition"}
          onClose={closeForm}
        >
          <form onSubmit={sendSubmission} className="space-y-sm" noValidate>
            <ErrorSummary errors={submissionErrors} />
            <div>
              <p className="text-body-md text-primary">
                Signée :{" "}
                <strong>{editing ? editing.author_name : (myFirstName.data ?? "…")}</strong>
              </p>
              <label className="mt-xs flex items-start gap-xs text-body-md">
                <input
                  type="checkbox"
                  className="mt-[3px]"
                  checked={submissionForm.hide_author ?? false}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, hide_author: e.target.checked })
                  }
                />
                <span>Masquer mon prénom aux autres collaborateurs de l'équipe</span>
              </label>
              <p className="ml-[22px] text-body-sm text-on-surface-variant">
                Ton manager et l'admin le voient toujours.
              </p>
            </div>
            {editing && (
              <p className="text-body-sm text-on-surface-variant">
                Équipe : {editing.team} (non modifiable)
              </p>
            )}
            {!editing && role === "manager" && (
              <Field label="Équipe" error={submissionErrors.team}>
                <select
                  required
                  value={submissionForm.team}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, team: e.target.value })}
                  className="w-full border border-outline-variant bg-surface px-sm py-xs font-body-md"
                >
                  <option value="">Choisis une de tes équipes</option>
                  {myTeams.data?.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}
            {!editing && role === "admin" && (
              <p className="text-body-sm text-on-surface-variant">Équipe : Admin</p>
            )}
            <Field label="Proposition" error={submissionErrors.content}>
              <TextArea
                rows={5}
                value={submissionForm.content}
                placeholder="Décris l'amélioration proposée pour le cabinet…"
                onChange={(e) => setSubmissionForm({ ...submissionForm, content: e.target.value })}
              />
              <CharCounter value={submissionForm.content} max={2000} min={5} />
            </Field>
            {editing ? (
              <p className="text-body-sm text-on-surface-variant">
                La pièce jointe reste inchangée.
              </p>
            ) : (
              <Field
                label="Document PDF (optionnel, 20 Mo max)"
                error={submissionErrors.attachment}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="block w-full text-body-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.type !== "application/pdf") {
                      setSubmissionErrors({
                        ...submissionErrors,
                        attachment: "Seuls les fichiers PDF sont acceptés.",
                      });
                      e.target.value = "";
                      setAttachment(null);
                      return;
                    }
                    if (f && f.size > 20 * 1024 * 1024) {
                      setSubmissionErrors({
                        ...submissionErrors,
                        attachment: "Le fichier dépasse 20 Mo.",
                      });
                      e.target.value = "";
                      setAttachment(null);
                      return;
                    }
                    const { attachment: _a, ...rest } = submissionErrors;
                    setSubmissionErrors(rest);
                    setAttachment(f);
                  }}
                />
              </Field>
            )}
            <FormActions
              pending={submit.isPending || updateMine.isPending}
              submitLabel={editing ? "ENREGISTRER" : "ENVOYER"}
              onCancel={closeForm}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
