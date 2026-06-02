interface AtcLogoProps {
  className?: string;
  compact?: boolean;
}

export default function AtcLogo({ className = "h-12 w-12", compact = false }: AtcLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${compact ? "" : "min-w-0"}`}>
      <svg className={className} viewBox="0 0 96 96" role="img" aria-label="ATC Transcriber">
        <defs>
          <linearGradient id="atc-logo-bg" x1="18" x2="78" y1="12" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="atc-logo-line" x1="20" x2="76" y1="20" y2="76" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f2fe" />
            <stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="80" height="80" rx="18" fill="#07111f" />
        <rect x="10.5" y="10.5" width="75" height="75" rx="16" fill="url(#atc-logo-bg)" opacity="0.22" />
        <path d="M48 19c14.5 0 26.5 10.8 28.2 24.8" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        <path d="M19.8 52.2C21.8 66 33.6 76.5 48 76.5c11 0 20.5-6.2 25.3-15.2" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
        <path d="M48 29v38" stroke="url(#atc-logo-line)" strokeWidth="4" strokeLinecap="round" />
        <path d="M31 63h34" stroke="url(#atc-logo-line)" strokeWidth="4" strokeLinecap="round" />
        <path d="M35 55h26" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <path d="M39 47h18" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />
        <path d="M45 38h6" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />
        <path d="M48 48l22-16" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="48" cy="48" r="5.5" fill="#e0f2fe" />
        <circle cx="70" cy="32" r="4" fill="#fbbf24" />
        <path d="M18 38l10-5 8 6-10 5-8-6Z" fill="#93c5fd" opacity="0.95" />
        <path d="M20 38l15 1" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
      </svg>
      {!compact && (
        <div className="min-w-0">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">ATC</div>
          <div className="truncate text-lg font-semibold text-white">Investigation Desk</div>
        </div>
      )}
    </div>
  );
}
