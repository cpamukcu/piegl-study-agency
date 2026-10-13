import { Icon, type IconName } from "@/components/icons";

type PageHeaderProps = { title: string; description: string; icon?: IconName; children?: React.ReactNode };

// A calm white page header: soft icon, large title, one line of help, optional actions.
// Gradients are kept for the Today hero; other pages only get a faint wash in the corner.
export function PageHeader({ title, description, icon, children }: PageHeaderProps) {
  return (
    <header className="relative mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 hidden h-48 w-72 rounded-full bg-wash blur-2xl sm:block"
      />
      <div className="relative min-w-0">
        {icon && (
          <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-lavender-50 text-lavender">
            <Icon name={icon} className="size-[22px]" />
          </span>
        )}
        <h1 className="text-[32px] leading-[1.1] tracking-tight sm:text-[36px]">{title}</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-muted">{description}</p>
      </div>
      {children && <div className="relative flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}
