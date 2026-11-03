import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewsImage, NewsLinks } from "@/components/news-media";
import { deleteDraftNews, fetchNews, publishDraftNews, timeAgo, type News } from "@/lib/dashboard";
import { CardActionButton } from "./card-action-button";
import { Icon } from "./icon";
import { NewsDraftDialog, type NewsDraftDialogControl } from "./news-draft-dialog";

export function NewsSection({
  isAdmin,
  canWriteNews,
  myName,
  myEmail,
  onRead,
  newsDialog,
}: {
  isAdmin: boolean;
  canWriteNews: boolean;
  myName: string;
  myEmail: string;
  onRead: (n: News) => void;
  /** État de la fenêtre de brouillon, tenu par le parent (le bouton de création est dans le titre de section). */
  newsDialog: NewsDraftDialogControl;
}) {
  const qc = useQueryClient();
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const publishDraft = useMutation({
    mutationFn: publishDraftNews,
    onSuccess: () => {
      toast.success("Actualité publiée");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError,
  });

  const removeDraft = useMutation({
    mutationFn: (n: { id: string; image_path?: string | null }) => deleteDraftNews(n.id, n.image_path),
    onSuccess: () => {
      toast.success("Brouillon supprimé");
      qc.invalidateQueries({ queryKey: ["news"] });
    },
    onError,
  });

  const visibleDrafts = news.data?.filter((n) => n.status === "brouillon") ?? [];
  const drafts = visibleDrafts.length;
  const published = news.data?.filter((n) => n.status === "publiée") ?? [];

  return (
    <section className="col-span-12 lg:col-span-8 rounded-[8px] bg-surface-container-lowest border border-outline-variant p-md flex flex-col gap-md">
      <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          Actualités du cabinet
        </h2>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {drafts} brouillon{drafts > 1 ? "s" : ""} en attente
        </span>
      </div>
      {canWriteNews && newsDialog.state && (
        <NewsDraftDialog
          state={newsDialog.state}
          myName={myName}
          myEmail={myEmail}
          onClose={newsDialog.close}
        />
      )}
      <div>
        {canWriteNews && visibleDrafts.length > 0 && (
          <>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-sm">
              BROUILLONS
            </h3>
            <div className="mb-md grid auto-rows-fr grid-cols-1 items-stretch gap-xs xl:grid-cols-2">
              {visibleDrafts.map((n) => {
                const own = (n.author_email ?? "").toLowerCase() === myEmail;
                const allowed = isAdmin || own;
                return (
                  <div
                    key={n.id}
                    className="flex min-h-28 min-w-0 flex-col gap-sm overflow-hidden rounded-[8px] bg-surface-container p-sm sm:flex-row sm:items-stretch"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-md">
                      <Icon name="draft" className="text-on-surface-variant" />
                      <div className="min-w-0">
                        <p className="font-body-md text-primary flex items-center gap-xs">
                          <span className="line-clamp-3 wrap-anywhere">{n.title}</span>
                          <span className="shrink-0 border border-outline-variant px-xs font-label-sm text-label-sm text-on-surface-variant">
                            Brouillon
                          </span>
                        </p>
                        <p className="text-xs text-on-surface-variant uppercase font-label-sm">
                          Créé {timeAgo(n.created_at)} • Par {n.author}
                        </p>
                      </div>
                    </div>
                    {allowed && (
                      <div className="flex shrink-0 flex-col justify-center gap-2 sm:items-end">
                        <CardActionButton
                          variant="white"
                          aria-haspopup="dialog"
                          aria-label={`Modifier le brouillon : ${n.title}`}
                          onClick={(e) => newsDialog.openEdit(n, e.currentTarget)}
                        >
                          Modifier
                        </CardActionButton>
                        <CardActionButton
                          variant="delete"
                          disabled={removeDraft.isPending}
                          onClick={() => {
                            if (window.confirm(`Supprimer le brouillon « ${n.title} » ?`))
                              removeDraft.mutate(n);
                          }}
                        >
                          Supprimer
                        </CardActionButton>
                        <CardActionButton
                          variant="white"
                          disabled={publishDraft.isPending}
                          onClick={() => {
                            if (window.confirm(`Publier l'actualité « ${n.title} » ? Elle sera visible par tous.`))
                              publishDraft.mutate(n.id);
                          }}
                        >
                          Publier
                        </CardActionButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <h3 className="font-label-md text-label-md text-on-surface-variant mb-sm">
          PUBLIÉES RÉCEMMENT
        </h3>
        <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-xs xl:grid-cols-2">
          {news.isLoading && (
            <p className="col-span-full text-body-sm text-on-surface-variant">Chargement…</p>
          )}
          {news.isError && (
            <p className="col-span-full text-body-sm text-error">
              Les actualités sont indisponibles.
            </p>
          )}
          {published.slice(0, 4).map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => onRead(n)}
              aria-haspopup="dialog"
              className="min-h-28 w-full rounded-[8px] text-left p-sm bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group min-w-0 overflow-hidden space-y-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {n.image_path && <NewsImage path={n.image_path} alt={n.title} />}
              <div className="flex items-center justify-between gap-sm min-w-0">
              <div className="flex items-center gap-md min-w-0">
                <Icon name="article" className="text-on-surface-variant" />
                <div className="min-w-0">
                  <p className="line-clamp-3 font-body-md text-primary group-hover:underline wrap-anywhere">
                    {n.title}
                  </p>
                  <p className="text-xs text-on-surface-variant uppercase font-label-sm">
                    Publiée {timeAgo(n.created_at)} • Par {n.author}
                  </p>
                </div>
              </div>
              {isAdmin && <Icon name="edit" className="text-on-surface-variant" />}
              </div>
              <NewsLinks links={n.links} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
