import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  ErrorSummary,
  Field,
  FormActions,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/manage/crud-ui";
import { NewsMediaEditor } from "@/components/news-media";
import { createNews, saveDraftNews, updateNews, type News, type NewsInput } from "@/lib/dashboard";
import { newsSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import {
  emptyMedia,
  linkErrors,
  mediaFromNews,
  toNewsLinks,
  type MediaDraft,
} from "@/lib/news-media";

export type NewsDialogState = { mode: "create" } | { mode: "edit"; news: News };

const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]):not([type=file]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * État de la fenêtre, remonté dans le parent : le bouton de création peut être rendu hors du composant
 * qui affiche la liste. `from` est l'élément qui ouvre la fenêtre (à défaut, l'élément qui a le focus) :
 * le focus lui est rendu à la fermeture, s'il existe encore.
 */
export function useNewsDialog() {
  const [state, setState] = useState<NewsDialogState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restore = useRef(false);

  useEffect(() => {
    if (state !== null || !restore.current) return;
    restore.current = false;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus();
  }, [state]);

  const remember = (from?: HTMLElement | null) => {
    opener.current =
      from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };

  return {
    state,
    openCreate: (from?: HTMLElement | null) => {
      remember(from);
      setState({ mode: "create" });
    },
    openEdit: (news: News, from?: HTMLElement | null) => {
      remember(from);
      setState({ mode: "edit", news });
    },
    close: () => {
      restore.current = true;
      setState(null);
    },
  };
}

export type NewsDialogControl = ReturnType<typeof useNewsDialog>;

/**
 * Fenêtre « Nouvelle actualité » / « Modifier l'actualité », partagée par la page de gestion des
 * actualités et l'accueil.
 * - `canPublish` (admin) : createNews / updateNews, statut Brouillon ou Publiée.
 * - sinon (manager) : saveDraftNews, statut verrouillé sur Brouillon, `myEmail` posé comme auteur
 *   technique (author_email) ; la base refuse tout autre brouillon que les siens.
 * `defaultAuthor` préremplit le champ Auteur en création ; en modification, il reprend celui de l'actualité.
 */
export function NewsFormDialog({
  state,
  canPublish,
  defaultAuthor,
  myEmail,
  onClose,
}: {
  state: NewsDialogState;
  canPublish: boolean;
  defaultAuthor: string;
  /** Utilisé seulement par les managers (saveDraftNews). */
  myEmail: string;
  onClose: () => void;
}) {
  const editing = state.mode === "edit" ? state.news : null;
  const qc = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [form, setForm] = useState<NewsInput>(() => ({
    title: editing?.title ?? "",
    body: editing?.body ?? "",
    author: editing ? (editing.author ?? "") : defaultAuthor,
    status: canPublish && editing ? editing.status : "brouillon",
  }));
  const [media, setMedia] = useState<MediaDraft>(() =>
    editing ? mediaFromNews(editing) : emptyMedia(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showLinkErrs, setShowLinkErrs] = useState(false);

  const save = useMutation({
    mutationFn: (input: NewsInput) => {
      if (!canPublish) {
        return saveDraftNews({
          id: editing?.id,
          title: input.title,
          body: input.body,
          author: input.author,
          author_email: myEmail,
          links: input.links ?? [],
          media,
        });
      }
      return editing ? updateNews(editing.id, input, media) : createNews(input, media);
    },
    onSuccess: () => {
      toast.success(
        !canPublish ? "Brouillon enregistré" : editing ? "Actualité modifiée" : "Actualité créée",
      );
      qc.invalidateQueries({ queryKey: ["news"] });
      onClose();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  // À l'ouverture, le focus entre dans la fenêtre (champ Titre).
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("input:not([type=file]):not([disabled])")?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!save.isPending) onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Le focus reste dans la fenêtre tant qu'elle est ouverte.
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const outside = !root.current?.contains(active);
    if (e.shiftKey && (active === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = validate(newsSchema, canPublish ? form : { ...form, status: "brouillon" });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setShowLinkErrs(true);
    if (Object.keys(linkErrors(media.links)).length) return;
    save.mutate({ ...res.data, links: toNewsLinks(media.links) });
  }

  return (
    <div ref={root} onKeyDown={onKeyDown}>
      <Modal title={editing ? "Modifier l'actualité" : "Nouvelle actualité"} onClose={onClose}>
        <form onSubmit={submit} className="space-y-sm" noValidate>
          <ErrorSummary errors={errors} />
          <Field label="Titre" error={errors.title}>
            <TextInput
              aria-label="Titre"
              value={form.title}
              maxLength={160}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Contenu" error={errors.body}>
            <TextArea
              aria-label="Contenu"
              rows={5}
              value={form.body}
              maxLength={5000}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <Field label="Image et liens">
            <NewsMediaEditor
              value={media}
              onChange={setMedia}
              linkErrs={showLinkErrs ? linkErrors(media.links) : {}}
              disabled={save.isPending}
              title={form.title}
            />
          </Field>
          <Field label="Auteur" error={errors.author}>
            <TextInput
              aria-label="Auteur"
              value={form.author}
              maxLength={80}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
          </Field>
          <Field label="Statut" error={errors.status}>
            <Select
              aria-label="Statut"
              aria-describedby={canPublish ? undefined : helpId}
              value={form.status}
              disabled={!canPublish}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="brouillon">Brouillon</option>
              {canPublish && <option value="publiée">Publiée</option>}
            </Select>
            {!canPublish && (
              <p id={helpId} className="text-body-sm text-on-surface-variant">
                Les managers enregistrent des brouillons. Un admin les publie.
              </p>
            )}
          </Field>
          <FormActions pending={save.isPending} pendingLabel="Enregistrement…" onCancel={onClose} />
        </form>
      </Modal>
    </div>
  );
}
