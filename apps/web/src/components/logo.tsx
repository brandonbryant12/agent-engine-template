export function EngineIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M14 4 L6 17 h8 L10 28 L26 15 h-8 L22 4 Z" fill="currentColor" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <div className="logo">
      <div className="logo-icon">
        <EngineIcon />
      </div>
      <span className="logo-text">Agent Engine</span>
    </div>
  );
}
