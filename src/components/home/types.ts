import type { News, Submission } from "@/lib/dashboard";

export type HomeProps = {
  /** E-mail en minuscules. */
  email: string;
  role: string;
  managerTeams: string[];
  myName: string;
  onReadNews: (n: News) => void;
  onReadSubmission: (s: Submission) => void;
  onReject: (s: Submission) => void;
  onApprove: (s: Submission) => void;
  onOpenArchive: () => void;
};
