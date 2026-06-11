import { del, list } from "@vercel/blob";
import { ensureProductAdminTables } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

type ProductImageRow = {
  id: string;
  epos_product_id: string;
  url: string;
  pathname: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
};

function isProductImagePathname(pathname: string) {
  return pathname.startsWith("products/") && /\.(avif|gif|jpe?g|png|webp)$/i.test(pathname);
}

async function listAllProductBlobs(maxBlobs = 20000) {
  const blobs: Array<{ url: string; pathname: string; size: number }> = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: "products/", limit: 1000, cursor });
    blobs.push(
      ...page.blobs
        .filter((blob) => isProductImagePathname(blob.pathname))
        .map((blob) => ({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size
        }))
    );
    cursor = page.cursor;
  } while (cursor && blobs.length < maxBlobs);

  return blobs.slice(0, maxBlobs);
}

function chooseKeptImages(rows: ProductImageRow[]) {
  const byProduct = new Map<string, ProductImageRow[]>();

  rows.forEach((row) => {
    byProduct.set(row.epos_product_id, [...(byProduct.get(row.epos_product_id) || []), row]);
  });

  const keptRows: ProductImageRow[] = [];
  const duplicateRows: ProductImageRow[] = [];

  byProduct.forEach((productRows) => {
    const sorted = [...productRows].sort((a, b) => {
      if (a.is_primary !== b.is_primary) {
        return a.is_primary ? -1 : 1;
      }

      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const [kept, ...duplicates] = sorted;
    if (kept) {
      keptRows.push(kept);
    }
    duplicateRows.push(...duplicates);
  });

  return { keptRows, duplicateRows };
}

async function deleteImageRows(ids: string[]) {
  if (!ids.length) {
    return 0;
  }

  const sql = getSql();
  let deleted = 0;

  for (let index = 0; index < ids.length; index += 500) {
    const batch = ids.slice(index, index + 500);
    await sql`DELETE FROM product_images WHERE id = ANY(${batch}::bigint[])`;
    deleted += batch.length;
  }

  return deleted;
}

async function deleteBlobs(pathnames: string[]) {
  let deleted = 0;

  for (let index = 0; index < pathnames.length; index += 500) {
    const batch = pathnames.slice(index, index + 500);
    await del(batch);
    deleted += batch.length;
  }

  return deleted;
}

export async function cleanupProductImageBlobs({ dryRun = true, deleteLimit = 500 } = {}) {
  await ensureProductAdminTables();

  const sql = getSql();
  const rows = (await sql`
    SELECT id::text, epos_product_id, url, pathname, is_primary, sort_order, created_at::text
    FROM product_images
    ORDER BY epos_product_id ASC, is_primary DESC, sort_order ASC, created_at DESC, id DESC
  `) as ProductImageRow[];
  const { keptRows, duplicateRows } = chooseKeptImages(rows);
  const keptPathnames = new Set(keptRows.map((row) => row.pathname).filter(Boolean) as string[]);
  const referencedPathnames = new Set(rows.map((row) => row.pathname).filter(Boolean) as string[]);
  const blobs = await listAllProductBlobs();
  const unneededBlobs = blobs.filter((blob) => !keptPathnames.has(blob.pathname));
  const duplicateImageIds = duplicateRows.map((row) => row.id);
  const deleteBatch = unneededBlobs.slice(0, Math.max(0, Math.trunc(deleteLimit))).map((blob) => blob.pathname);

  let duplicateRowsDeleted = 0;
  let blobsDeleted = 0;

  if (!dryRun) {
    duplicateRowsDeleted = await deleteImageRows(duplicateImageIds);
    blobsDeleted = await deleteBlobs(deleteBatch);
  }

  return {
    dryRun,
    productImageRows: rows.length,
    productsWithKeptImages: keptRows.length,
    duplicateImageRows: duplicateRows.length,
    duplicateRowsDeleted,
    blobsFound: blobs.length,
    referencedBlobPathnames: referencedPathnames.size,
    keptBlobPathnames: keptPathnames.size,
    unneededBlobs: unneededBlobs.length,
    blobsDeleted,
    remainingUnneededBlobs: dryRun ? unneededBlobs.length : Math.max(unneededBlobs.length - blobsDeleted, 0),
    deleteLimit,
    samples: {
      kept: keptRows.slice(0, 5).map((row) => ({ productId: row.epos_product_id, pathname: row.pathname })),
      delete: unneededBlobs.slice(0, 5).map((blob) => blob.pathname)
    }
  };
}
