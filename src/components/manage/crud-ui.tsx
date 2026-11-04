import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import type { FieldErrors } from "@/lib/manage-schemas";

/** Premier champ de saisie utile d'une fenêtre : ni masqué, ni fichier, ni case, ni radio, ni désactivé. */
const FIRST_FIELD =
  "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([disabled]),select:not([disabled]),textarea:not([disabled])";

export function ManageIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

const inputBase =
  "w-full bg-card border border-outline-variant focus:border-primary focus:outline-none p-sm font-body-md text-on-surface";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-xs">
      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Le focus entre sur le premier champ du formulaire, sinon sur « Fermer ».
            e.preventDefault();
            const first = content.current?.querySelector<HTMLElement>(FIRST_FIELD);
            (first ?? closeButton.current)?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col border border-outline bg-surface-container-lowest focus:outline-none"
        >
          <div className="flex shrink-0 items-center justify-between gap-sm border-b border-outline-variant px-sm py-xs md:px-md">
            <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary wrap-anywhere">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              ref={closeButton}
              aria-label="Fermer"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-on-surface-variant hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ManageIcon name="close" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-sm overflow-y-auto p-sm md:p-md">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function FormActions({
  pending,
  onCancel,
  submitLabel = "ENREGISTRER",
  pendingLabel = "…",
}: {
  pending?: boolean;
  onCancel: () => void;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-xs pt-sm">
      <button
        type="button"
        onClick={onCancel}
        className="px-md py-xs border border-outline text-primary font-label-md text-label-md hover:bg-surface-container"
      >
        ANNULER
      </button>
      <button
        type="submit"
        disabled={pending}
        className="px-lg py-xs bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}

export function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const count = Object.keys(errors).length;
  if (!count) return null;
  return (
    <div role="alert" className="text-body-sm text-error border border-error/40 bg-error-container/30 p-sm wrap-anywhere">
      <p>{count} champ{count > 1 ? "s" : ""} à corriger avant l'enregistrement.</p>
      <ul className="mt-xs list-disc pl-md">
        {Object.entries(errors).map(([k, m]) => (
          <li key={k}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex gap-xs shrink-0">
      <button
        type="button"
        onClick={onEdit}
        className="px-sm py-1 border border-outline text-primary font-label-sm text-label-sm hover:bg-surface-container"
      >
        MODIFIER
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="px-sm py-1 border border-error text-error font-label-sm text-label-sm hover:bg-error-container disabled:opacity-50"
      >
        SUPPRIMER
      </button>
    </div>
  );
}

export function ConfirmDelete({
  label,
  onCancel,
  onConfirm,
  pending,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel}>
      <p className="font-body-md text-on-surface">
        Supprimer définitivement <strong className="text-primary">{label}</strong> ? Cette action est
        irréversible.
      </p>
      <div className="flex justify-end gap-xs pt-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-md py-xs border border-outline text-primary font-label-md text-label-md hover:bg-surface-container"
        >
          ANNULER
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="px-lg py-xs bg-error text-on-error font-label-md text-label-md disabled:opacity-50"
        >
          {pending ? "SUPPRESSION…" : "SUPPRIMER"}
        </button>
      </div>
    </Modal>
  );
}
