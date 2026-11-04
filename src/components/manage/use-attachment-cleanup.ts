import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { processAttachmentDeletionQueue } from "@/lib/dashboard";

/**
 * Suppression silencieuse des pièces jointes échues, une fois par chargement (/manage, ou l'accueil de
 * l'admin). `enabled` à faux : rien ne se passe (les hooks ne peuvent pas être appelés sous condition).
 */
export function useAttachmentQueueCleanup(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    processAttachmentDeletionQueue()
      .then((r) => {
        if (r.remaining > 0) toast.error(`${r.remaining} document(s) n'ont pas pu être supprimés.`);
        else if (r.deleted > 0) toast.success(`${r.deleted} document(s) supprimé(s)`);
      })
      .catch(() => toast.error("La suppression des documents échus a échoué."))
      .finally(() => qc.invalidateQueries({ queryKey: ["attachment_deletion_queue"] }));
  }, [qc, enabled]);
}
