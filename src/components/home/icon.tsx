export function Icon({
  name,
  className = "",
  size,
}: {
  name: string;
  className?: string;
  /** Taille en pixels ; à défaut, celle de la feuille de style des icônes. */
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  );
}
