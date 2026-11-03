import { MyRequestsSections } from "./my-requests-tabs";
import type { HomeProps } from "./types";

export function CollaborateurHome({ email, onReadNews, onReadSubmission }: HomeProps) {
  return <MyRequestsSections email={email} onRead={onReadSubmission} onReadNews={onReadNews} />;
}
