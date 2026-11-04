import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete, RowActions } from "@/components/manage/crud-ui";
import { NewsFormDialog, useNewsDialog } from "@/components/home/news-draft-dialog";
import { deleteNews, fetchAllNews, timeAgo, type News } from "@/lib/dashboard";
import { NewsImage, NewsLinks } from "@/components/news-media";

const newsStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  publiée: "Publiée",
};

/** Corps de la page /manage/news, aussi affiché dans l'accueil de l'admin. */
export function NewsAdminPanel() {
  const qc = useQueryClient();
  const dialog = useNewsDialog();
  const [toDelete, setToDelete] = useState<News | null>(null);

  const list = useQuery({ queryKey: ["news", "all"], queryFn: fetchAllNews, retry: false });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["news"] });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const remove = useMutation({
    mutationFn: (n: News) => deleteNews(n.id, n.image_path),
    onSuccess: () => {
      toast.success("Actualité supprimée");
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  return (
    <section className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          Actualités ({list.data?.length ?? 0})
        </h2>
        <button
          onClick={(e) => dialog.openCreate(e.currentTarget)}
          className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md"
        >
          + NOUVELLE ACTUALITÉ
        </button>
      </div>

      {list.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {list.isError && (
        <p className="text-body-sm text-error">Impossible de charger les actualités.</p>
      )}

      <div className="space-y-xs">
        {list.data?.map((n) => (
          <article
            key={n.id}
            className="flex flex-col sm:flex-row items-start justify-between gap-sm p-sm min-w-0 overflow-hidden bg-card border border-outline-variant"
          >
            <div className="min-w-0 flex-1 space-y-xs">
              {n.image_path && <NewsImage path={n.image_path} alt={n.title} />}
              <p className="font-body-md text-primary font-bold wrap-anywhere">{n.title}</p>
              <p className="text-body-sm text-on-surface-variant line-clamp-2 wrap-anywhere">{n.body}</p>
              <NewsLinks links={n.links} />
              <p className="text-[11px] font-label-sm text-on-surface-variant uppercase mt-xs">
                 {newsStatusLabels[n.status] ?? n.status} • {n.author} • {timeAgo(n.created_at)}
              </p>
            </div>
            <RowActions onEdit={() => dialog.openEdit(n)} onDelete={() => setToDelete(n)} />
          </article>
        ))}
        {list.data?.length === 0 && (
          <p className="text-body-sm italic text-on-surface-variant">Aucune actualité.</p>
        )}
      </div>

      {dialog.state && (
        <NewsFormDialog
          state={dialog.state}
          canPublish
          defaultAuthor="Direction Recrutement"
          myEmail=""
          onClose={dialog.close}
        />
      )}

      {toDelete && (
        <ConfirmDelete
          label={toDelete.title}
          pending={remove.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete)}
        />
      )}
    </section>
  );
}
