interface TrustCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function TrustCard({ icon, title, description }: TrustCardProps) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-[var(--kt-blue-soft)] flex items-center justify-center text-[var(--kt-brand-blue)] flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-[var(--kt-text)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--kt-text-muted)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
