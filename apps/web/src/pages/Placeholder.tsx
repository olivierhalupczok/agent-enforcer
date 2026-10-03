interface PlaceholderProps {
  title: string
  issue: string
}

export function Placeholder({ title, issue }: PlaceholderProps) {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="m-0 text-[28px] font-semibold tracking-tight">{title}</h1>
      <div className="rounded-xl border border-dashed border-line-strong bg-surface p-6 text-sm text-muted">
        Coming in {issue}.
      </div>
    </section>
  )
}
