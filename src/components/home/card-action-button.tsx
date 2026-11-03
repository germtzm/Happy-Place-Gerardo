import type { ButtonHTMLAttributes } from "react";

/**
 * Bouton d'action d'une carte (coins droits, 36 px). Une couleur par sens :
 * - `white` : MODIFIER et toute autre action (Voir les documents, Tout télécharger, Publier...) ;
 * - `validate` : VALIDER (#0B3D1E sur #8FD3A5 : 7,07:1) ;
 * - `delete` : SUPPRIMER (#F9F8F5 sur #28282D) ;
 * - `reject` : REFUSER (#72020E sur #FED2CE).
 * Le sens n'est jamais porté par la couleur seule : le libellé en capitales le dit.
 */
export type CardActionVariant = "white" | "validate" | "delete" | "reject";

const VARIANTS: Record<CardActionVariant, string> = {
  white: "border-[#28282D] bg-white text-[#28282D] hover:bg-[#EEEDEA]",
  validate: "border-[#0B3D1E] bg-[#8FD3A5] text-[#0B3D1E] hover:bg-[#7BC794]",
  delete: "border-[#28282D] bg-[#28282D] text-[#F9F8F5] hover:border-[#3A3A41] hover:bg-[#3A3A41]",
  reject: "border-[#72020E] bg-[#FED2CE] text-[#72020E] hover:bg-[#FBBDB8]",
};

const BASE =
  "inline-flex min-h-[36px] w-full items-center justify-center rounded-none border px-md py-1 font-label-md text-label-md uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28282D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[120px]";

export function CardActionButton({
  variant = "white",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: CardActionVariant }) {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
