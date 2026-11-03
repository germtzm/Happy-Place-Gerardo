import { useContext } from "react";
import { Button } from "@/components/ui/button";
import { HomeContext } from "./home-context";
import { Icon } from "./icon";

/** « Soumettre une demande » et « Exporter le rapport » : à droite du titre de la section Demandes. */
export function RequestActions() {
  const { onSubmitRequest, onExport, exporting } = useContext(HomeContext);
  return (
    <div className="flex flex-wrap items-center gap-xs">
      <button
        type="button"
        onClick={onSubmitRequest}
        className="flex min-h-[44px] items-center gap-xs bg-primary px-md py-xs font-label-md text-label-md text-on-primary shadow-sm transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Icon name="add" /> SOUMETTRE UNE DEMANDE
      </button>
      <Button
        type="button"
        variant="outline"
        disabled={exporting}
        onClick={onExport}
        className="h-auto min-h-[44px] rounded-none border-outline bg-surface px-md py-xs font-label-md text-label-md text-primary shadow-none hover:bg-surface-container"
      >
        <Icon name="file_download" /> {exporting ? "EXPORT EN COURS…" : "EXPORTER LE RAPPORT"}
      </Button>
    </div>
  );
}
