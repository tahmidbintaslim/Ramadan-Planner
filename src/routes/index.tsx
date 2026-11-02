import { createFileRoute } from "@tanstack/react-router";

// Temporary placeholder until the landing page is ported (Task 5).
export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Ramadan Planner</h1>
      <p>TanStack Start migration in progress.</p>
    </main>
  );
}
