import Link from "next/link";
import { Card } from "@/components/card";
import { isProductId } from "@/lib/catalog";

export default async function CancelledPage({ searchParams }: PageProps<"/payment/cancelled">) {
  const { product } = await searchParams;
  // Only a known product ID is echoed back; anything else is ignored.
  const retry = isProductId(product) ? `/?product=${encodeURIComponent(product)}` : "/";

  return (
    <Card>
      <h1 className="text-2xl font-semibold">Payment Cancelled</h1>
      <p className="mt-2 mb-8 text-sm text-zinc-500">No charge was made.</p>
      <Link
        href={retry}
        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center font-medium text-white hover:bg-indigo-500"
      >
        Try Again
      </Link>
      <Link
        href="/"
        className="mt-3 block w-full rounded-lg border border-black/10 px-4 py-3 text-center font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        Back Home
      </Link>
    </Card>
  );
}
