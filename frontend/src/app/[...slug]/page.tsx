import Home from "../page";
import { Suspense } from "react";

const routes = ["sector", "compare", "rankings", "methodology", "intelligence"];
const companyIds = Array.from({ length: 20 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);

export function generateStaticParams() {
  return [
    ...routes.map((slug) => ({ slug: [slug] })),
    ...companyIds.map((id) => ({ slug: ["companies", id] })),
  ];
}

export default function ResearchRoute({ params }: PageProps<"/[...slug]">) {
  return <Suspense fallback={<main className="app-shell"><div className="state-panel">Opening Ferrum research…</div></main>}><ResearchRouteContent params={params} /></Suspense>;
}

async function ResearchRouteContent({ params }: Pick<PageProps<"/[...slug]">, "params">) {
  const { slug } = await params;
  const routePath = `/${slug.join("/")}`;
  return <Home routePath={routePath} />;
}
