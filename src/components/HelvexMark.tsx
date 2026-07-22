type HelvexMarkProps = {
  size?: number;
  className?: string;
};

/** Helvex brand mark (SVG). */
export function HelvexMark({ size = 36, className }: HelvexMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/helvex-mark.svg"
      alt="Helvex"
      width={size}
      height={size}
      className={className ?? "brand-mark-img"}
      draggable={false}
    />
  );
}

export function appName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Helvex";
}
