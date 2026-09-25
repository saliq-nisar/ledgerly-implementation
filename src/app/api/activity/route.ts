import { activitySince } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** Playground timeline feed. Safe fields only (IDs, codes, amounts, durations). */
export function GET(request: Request) {
  // Demo-only endpoint: this app runs the library in test mode exclusively.
  if (process.env.PAYMENTS_ENVIRONMENT === "production") return new Response(null, { status: 404 });

  const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const events = activitySince(Number.isSafeInteger(after) && after > 0 ? after : 0);
  return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
