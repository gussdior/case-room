import { notFound } from "next/navigation";
import { isShareRole } from "@/lib/share-text";
import CasePage from "../../page";

// A shared link that asks for one role, for example /case/<id>/for/researcher.
// It shows the same case page; only the link preview card changes.
export default async function SharedForRole({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, role } = await params;
  if (!isShareRole(role)) notFound();
  return <CasePage params={Promise.resolve({ id })} searchParams={searchParams} />;
}
