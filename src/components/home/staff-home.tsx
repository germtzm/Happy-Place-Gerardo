import type { ReactNode } from "react";
import { ValidatedSubmissions } from "@/components/dashboard-extras";
import { BlockersSection } from "./blockers-section";
import { MetricsSection } from "./metrics-section";
import { MySubmissions } from "./my-submissions";
import { NewsSection } from "./news-section";
import { PendingSubmissions } from "./pending-submissions";
import { HomeTopCards } from "./top-cards";
import type { HomeProps } from "./types";

export function HomeTile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="col-span-12 min-w-0 bg-surface-container-lowest border border-outline-variant p-md">
      <h2 className="font-headline-sm text-headline-sm text-primary border-b border-outline-variant pb-sm mb-md">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Moitié basse manager/admin : Demandes, Actualités, Points bloquants, Indicateurs, puis une tuile de gestion. */
export function StaffHome({
  isAdmin,
  managementTile,
  ...p
}: HomeProps & { isAdmin: boolean; managementTile: ReactNode }) {
  return (
    <>
      <HomeTopCards onReadNews={p.onReadNews} />
      <div className="bento-grid">
        <div className="col-span-12 min-w-0 space-y-md">
          <PendingSubmissions
            canReview
            onRead={p.onReadSubmission}
            onReject={p.onReject}
            onApprove={p.onApprove}
          />
          <MySubmissions email={p.email} onRead={p.onReadSubmission} />
          <ValidatedSubmissions
            role={p.role}
            email={p.email}
            managerTeams={p.managerTeams}
            onRead={p.onReadSubmission}
          />
        </div>
        <div className="col-span-12 min-w-0">
          <NewsSection
            isAdmin={isAdmin}
            canWriteNews
            myName={p.myName}
            myEmail={p.email}
            onRead={p.onReadNews}
          />
        </div>
        <BlockersSection isAdmin={isAdmin} onOpenArchive={p.onOpenArchive} />
        <MetricsSection isAdmin={isAdmin} />
        {managementTile}
      </div>
    </>
  );
}
