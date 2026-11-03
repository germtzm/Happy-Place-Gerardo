import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  ErrorSummary,
  Field,
  FormActions,
  Modal,
  TextArea,
  TextInput,
} from "@/components/manage/crud-ui";
import { NewsMediaEditor } from "@/components/news-media";
import { saveDraftNews, type News } from "@/lib/dashboard";
import { newsSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import {
  emptyMedia,
  linkErrors,
  mediaFromNews,
  toNewsLinks,
  type MediaDraft,
} from "@/lib/news-media";

/** Sur l'accueil, seuls le titre et le contenu se saisissent : auteur et statut sont posés par le code. */
const draftSchema = newsSchema.pick({ title: true, body: true });

export type NewsDraftDialogState = { mode: "create" } | { mode: "edit"; news: News };

const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]):not([type=file]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * État de la fenêtre, remonté dans le parent : le bouton « CRÉER UNE ACTUALITÉ » est rendu à droite du
 * titre de la section, hors de NewsSection. `from` est l'élément qui ouvre la fenêtre : le focus lui est
 * rendu à la fermeture, s'il existe encore.
 */
export function useNewsDraftDialog() {
  const [state, setState] = useState<NewsDraftDialogState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restore = useRef(false);

  useEffect(() => {
    if (state !== null || !restore.current) return;
    restore.current = false;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus();
  }, [state]);

  return {
    state,
    openCreate: (from: HTMLElement) => {
      opener.current = from;
      setState({ mode: "create" });
    },
    openEdit: (news: News, from: HTMLElement) => {
      opener.current = from;
      setState({ mode: "edit", news });
    },
    close: () => {
      restore.current = true;
      setState(null);
    },
  };
}

export type NewsDraftDialogControl = ReturnType<typeof useNewsDraftDialog>;

/** Fenêtre de création et de modification d'un brouillon d'actualité (statut toujours « brouillon »). */
export function NewsDraftDialog({
  state,
  myName,
  myEmail,
  onClose,
}: {
  state: NewsDraftDialogState;
  myName: string;
  myEmail: string;
  onClose: () => void;
}) {
  const editing = state.mode === "edit" ? state.news : null;
  const qc = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [media, setMedia] = useState<MediaDraft>(() =>
    editing ? mediaFromNews(editing) : emptyMedia(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showLinkErrs, setShowLinkErrs] = useState(false);

  const save = useMutation({
    mutationFn: saveDraftNews,
    onSuccess: () => {
      toast.success("Brouillon enregistré");
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
    const res = validate(draftSchema, { title, body });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setShowLinkErrs(true);
    if (Object.keys(linkErrors(media.links)).length) {
      toast.error("Corrige les liens invalides avant d'enregistrer.");
      return;
    }
    save.mutate({
      id: editing?.id,
      title: res.data.title,
      body: res.data.body,
      author: myName,
      author_email: myEmail,
      links: toNewsLinks(media.links),
      media,
    });
  }

  return (
    <div ref={root} onKeyDown={onKeyDown}>
      <Modal title={editing ? "Modifier le brouillon" : "Nouvelle actualité"} onClose={onClose}>
        <form onSubmit={submit} className="space-y-sm" noValidate>
          <ErrorSummary errors={errors} />
          <Field label="Titre" error={errors.title}>
            <TextInput
              aria-label="Titre"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Contenu" error={errors.body}>
            <TextArea
              aria-label="Contenu"
              rows={5}
              value={body}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Field label="Image et liens">
            <NewsMediaEditor
              value={media}
              onChange={setMedia}
              linkErrs={showLinkErrs ? linkErrors(media.links) : {}}
              disabled={save.isPending}
              title={title}
            />
          </Field>
          <FormActions pending={save.isPending} pendingLabel="Enregistrement…" onCancel={onClose} />
        </form>
      </Modal>
    </div>
  );
}
