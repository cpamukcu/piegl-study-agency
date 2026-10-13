import { SoftShapes } from "@/components/soft-shapes";

type PageHeaderProps = { title: string; description: string };

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="relative -mx-4 mb-8 overflow-hidden bg-brand px-6 pb-10 pt-8 text-white md:mx-0 md:rounded-[28px] md:px-8">
      <SoftShapes />
      <div className="relative">
        <h1 className="text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-white/85">{description}</p>
      </div>
    </header>
  );
}
