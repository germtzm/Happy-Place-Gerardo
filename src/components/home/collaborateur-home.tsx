import { HomeTopCards } from "./top-cards";
import { MyRequestsTabs } from "./my-requests-tabs";
import type { HomeProps } from "./types";

export function CollaborateurHome({ email, onReadNews, onReadSubmission }: HomeProps) {
  return (
    <>
      <HomeTopCards onReadNews={onReadNews} />
      <div className="bento-grid">
        <MyRequestsTabs email={email} onRead={onReadSubmission} />
      </div>
    </>
  );
}
