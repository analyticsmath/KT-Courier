interface HowItWorksStepProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isLast?: boolean;
}

export function HowItWorksStep({ step, title, description, icon, isLast }: HowItWorksStepProps) {
  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Connector line */}
      {!isLast && (
        <div
          className="hidden md:block absolute top-10 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] h-px bg-[var(--kt-border)]"
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 w-16 h-16 rounded-2xl bg-[var(--kt-brand-navy)] text-white flex items-center justify-center mb-4 shadow-lg">
        {icon}
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--kt-brand-blue)] text-white text-xs font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="text-base font-bold text-[var(--kt-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--kt-text-muted)] leading-relaxed max-w-xs">{description}</p>
    </div>
  );
}
