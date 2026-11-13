const highlights = [
  {
    title: 'Private discovery',
    description: 'Swipe through recipes one at a time and save only the ones you love.',
  },
  {
    title: 'Shared spaces',
    description: 'Bring your household or cooking crew together in one place.',
  },
  {
    title: 'Collaborative planning',
    description: 'Turn saved recipes into a shared weekly meal plan.',
  },
] as const;

export function HomePage() {
  return (
    <section className="space-y-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          MealMate MVP
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Plan meals you love, together.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Discover recipes one at a time, keep your favourites close, and build shared meal plans
          without the group-chat chaos.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
            Project foundation is ready
          </span>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
            Individual discovery is next
          </span>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {highlights.map((highlight) => (
          <li
            key={highlight.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">{highlight.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
