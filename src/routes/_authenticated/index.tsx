import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorSummary, Field, FormActions, Modal, TextArea, TextInput } from "@/components/manage/crud-ui";
import { rejectionSchema, submissionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { BrandHeader } from "@/components/brand-header";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { SubmissionReader } from "@/components/submission-reader";
import { NewsReader } from "@/components/news-reader";
import { DepartureNotices } from "@/components/departure-notices";
import { BlockerArchive } from "@/components/dashboard-extras";
import { AdminHome } from "@/components/home/admin-home";
import { CollaborateurHome } from "@/components/home/collaborateur-home";
import { HomeHeader } from "@/components/home/home-header";
import { ManagerHome } from "@/components/home/manager-home";
import type { HomeProps } from "@/components/home/types";
import {
  exportMyRecentSubmissions,
  REJECTION_CATEGORIES,
  type News,
  type Submission,
  reviewSubmission,
  submitIdea,
  type SubmissionInput,
} from "@/lib/dashboard";

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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reading, setReading] = useState<Submission | null>(null);
  const [readingNews, setReadingNews] = useState<News | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
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
    }, attachment),
    onSuccess: () => {
      setSubmissionForm(null);
      setAttachment(null);
      setSubmissionErrors({});
      toast.success("Soumission envoyée");
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  const roleLabel = role === "admin" ? "ADMIN" : role === "manager" ? "MANAGER" : "COLLABORATEUR";

  function sendSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionForm) return;
    // Collaborators: team is set server-side from their account
    // Admin: always the « Admin » team (set server-side); manager: one of their teams
    const team = role === "collaborateur" ? "auto" : role === "admin" ? "Admin" : submissionForm.team;
    const result = validate(submissionSchema, { ...submissionForm, team, status: "en attente" });
    if (!result.ok) {
      setSubmissionErrors(result.errors);
      return;
    }
    setSubmissionErrors({});
    submit.mutate(result.data);
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <BrandHeader />
      <main className="flex-grow w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        {email && <DepartureNotices email={email} />}
        <HomeHeader
          email={email}
          roleLabel={roleLabel}
          isAdmin={isAdmin}
          exporting={exportReport.isPending}
          onExport={() => exportReport.mutate()}
          onSubmitIdea={() => {
            setSubmissionErrors({});
            const only = role === "manager" && myTeams.data?.length === 1 ? myTeams.data[0] : "";
            setSubmissionForm({ author_name: "", team: only, content: "", status: "en attente" });
          }}
        />

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
      </main>
      <BlockerArchive open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <NewsReader news={readingNews} onClose={() => setReadingNews(null)} />
      <SubmissionReader
        submission={reading}
        onClose={() => setReading(null)}
        onReject={reading && canReview && reading.status === "en attente" ? () => startReject(reading) : undefined}
        onApprove={
          reading && canReview && reading.status === "en attente"
            ? () => review.mutate({ id: reading.id, status: "validée" })
            : undefined
        }
        approving={review.isPending}
      />
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
        <Modal title="Soumettre une proposition" onClose={() => setSubmissionForm(null)}>
          <form onSubmit={sendSubmission} className="space-y-sm" noValidate>
            <ErrorSummary errors={submissionErrors} />
            <Field label="Nom" error={submissionErrors.author_name}>
              <TextInput
                value={submissionForm.author_name}
                maxLength={80}
                placeholder="Ton nom"
                onChange={(e) => setSubmissionForm({ ...submissionForm, author_name: e.target.value })}
              />
            </Field>
            {role === "manager" && (
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
            {role === "admin" && (
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
            <Field label="Document PDF (optionnel, 20 Mo max)" error={submissionErrors.attachment}>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full text-body-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.type !== "application/pdf") {
                    setSubmissionErrors({ ...submissionErrors, attachment: "Seuls les fichiers PDF sont acceptés." });
                    e.target.value = ""; setAttachment(null); return;
                  }
                  if (f && f.size > 20 * 1024 * 1024) {
                    setSubmissionErrors({ ...submissionErrors, attachment: "Le fichier dépasse 20 Mo." });
                    e.target.value = ""; setAttachment(null); return;
                  }
                  const { attachment: _a, ...rest } = submissionErrors;
                  setSubmissionErrors(rest);
                  setAttachment(f);
                }}
              />
            </Field>
            <FormActions
              pending={submit.isPending}
              submitLabel="ENVOYER"
              onCancel={() => setSubmissionForm(null)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
