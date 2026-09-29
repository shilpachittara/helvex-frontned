type HelvexMarkProps = {
  size?: number;
  className?: string;
};

type HelvexLockupProps = {
  height?: number;
  className?: string;
};

/** Helvex brand mark (icon only). */
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

/** Helvex icon + wordmark lockup (for dark UI backgrounds). */
export function HelvexLockup({ height = 28, className }: HelvexLockupProps) {
  // Lockup viewBox 1753×420 → width follows aspect ratio
  const width = Math.round(height * (1753 / 420));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/helvex-lockup.svg"
      alt={appName()}
      width={width}
      height={height}
      className={className ?? "brand-lockup"}
      draggable={false}
    />
  );
}

export function appName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Helvex";
}
