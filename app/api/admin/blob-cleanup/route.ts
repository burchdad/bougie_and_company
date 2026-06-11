import { isAdminRequest } from "@/lib/admin-products";
import { cleanupProductImageBlobs } from "@/lib/blob-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean; deleteLimit?: number };
    const deleteLimit = Number.isFinite(Number(body.deleteLimit)) ? Math.min(Math.max(Number(body.deleteLimit), 1), 1000) : 500;
    const result = await cleanupProductImageBlobs({
      dryRun: body.dryRun !== false,
      deleteLimit
    });

    return Response.json(
      {
        ok: true,
        message: result.dryRun
          ? `Blob cleanup dry run found ${result.unneededBlobs} unneeded product image blob${result.unneededBlobs === 1 ? "" : "s"} and ${result.duplicateImageRows} duplicate image row${result.duplicateImageRows === 1 ? "" : "s"}.`
          : `Blob cleanup deleted ${result.blobsDeleted} blob${result.blobsDeleted === 1 ? "" : "s"} and ${result.duplicateRowsDeleted} duplicate image row${result.duplicateRowsDeleted === 1 ? "" : "s"}.`,
        result
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blob cleanup failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
