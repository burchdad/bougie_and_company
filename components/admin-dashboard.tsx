"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, EyeOff, FileText, Gift, KeyRound, LayoutDashboard, Loader2, Package, PackageSearch, Save, Search, Settings, ShoppingBag, Star, Tags, Truck, UploadCloud } from "lucide-react";
import { shopDepartments } from "@/lib/data";

type AdminProduct = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  storefront_stock_override: string | null;
  stock_id: string | null;
  stock_location_id: string | null;
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
};

type SiteCategory = {
  id: number;
  label: string;
  slug: string;
  href: string;
  parent_id: number | null;
  sort_order: number;
  is_header: boolean;
  epos_category_id: string | null;
};

type SiteDiscount = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  value: string;
  minimum_order_amount: string | null;
  usage_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  epos_discount_reason_id: string | null;
};

type SiteOrder = {
  id: number;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_service: string;
  subtotal: string;
  shipping_amount: string;
  total: string;
  epos_order_id: string | null;
  epos_customer_id: string | null;
  epos_sync_status: string;
  epos_sync_message: string | null;
  created_at: string;
};

type ShippingSettings = {
  origin_postal_code: string;
  free_shipping_threshold: string;
  base_rate: string;
  per_item_rate: string;
  texas_rate: string;
  remote_rate: string;
  epos_shipping_product_id: string | null;
};

type ProductResponse = {
  ok: boolean;
  products?: AdminProduct[];
  message?: string;
};

const adminStorageKey = "bougie-admin-key";
const adminSessionKey = "bougie-admin-signed-in";
const adminTabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "products", label: "Products", icon: Package },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "discounts", label: "Discounts", icon: Gift },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "content", label: "Legal / Content", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

type AdminTab = (typeof adminTabs)[number]["id"];

function money(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toFixed(2)}` : "No price";
}

function adminStockValue(product: AdminProduct | null | undefined) {
  if (!product) {
    return "";
  }

  const eposStock = Number(product.stock || 0);
  const overrideStock = Number(product.storefront_stock_override || 0);
  return eposStock > 0 ? product.stock || "" : overrideStock > 0 ? product.storefront_stock_override || "" : product.stock || "";
}

export function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<SiteCategory[]>([]);
  const [discounts, setDiscounts] = useState<SiteDiscount[]>([]);
  const [orders, setOrders] = useState<SiteOrder[]>([]);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [importingImages, setImportingImages] = useState(false);
  const [repairingStock, setRepairingStock] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedKey = window.localStorage.getItem(adminStorageKey) || "";
    const signedIn = window.sessionStorage.getItem(adminSessionKey) === "true";

    setAdminKey(storedKey);
    setIsSignedIn(Boolean(storedKey && signedIn));
  }, []);

  const selectedProduct = useMemo(() => (isCreatingProduct ? null : products.find((product) => product.epos_product_id === selectedId) || products[0]), [isCreatingProduct, products, selectedId]);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === editingCategoryId) || null, [categories, editingCategoryId]);
  const selectedDiscount = useMemo(() => discounts.find((discount) => discount.id === editingDiscountId) || null, [discounts, editingDiscountId]);

  async function loadProducts(searchTerm = query) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/products?q=${encodeURIComponent(searchTerm)}`, {
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as ProductResponse;

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not load admin products.");
        return;
      }

      const nextProducts = result.products || [];
      setProducts(nextProducts);
      setSelectedId((current) => (nextProducts.some((product) => product.epos_product_id === current) ? current : nextProducts[0]?.epos_product_id || ""));
    } catch {
      setMessage("Could not connect to the admin product backend.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    setMessage("");

    try {
      const response = await fetch("/api/admin/categories", {
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; categories?: SiteCategory[]; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not load categories.");
        return;
      }

      setCategories(result.categories || []);
    } catch {
      setMessage("Could not connect to the category backend.");
    }
  }

  async function loadDiscounts() {
    setMessage("");

    try {
      const response = await fetch("/api/admin/discounts", {
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; discounts?: SiteDiscount[]; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not load discounts.");
        return;
      }

      setDiscounts(result.discounts || []);
    } catch {
      setMessage("Could not connect to the discount backend.");
    }
  }

  async function loadOrders() {
    setMessage("");

    try {
      const response = await fetch("/api/admin/orders", {
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; orders?: SiteOrder[]; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not load orders.");
        return;
      }

      setOrders(result.orders || []);
    } catch {
      setMessage("Could not connect to the orders backend.");
    }
  }

  async function loadShippingSettings() {
    setMessage("");

    try {
      const response = await fetch("/api/admin/shipping", {
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; settings?: ShippingSettings; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not load shipping settings.");
        return;
      }

      setShippingSettings(result.settings || null);
    } catch {
      setMessage("Could not connect to the shipping backend.");
    }
  }

  const productStats = useMemo(() => {
    const featured = products.filter((product) => product.is_featured).length;
    const hidden = products.filter((product) => product.is_hidden).length;
    const withPhotos = products.filter((product) => product.primary_image_url).length;

    return { featured, hidden, withPhotos };
  }, [products]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey.trim()) {
      setMessage("Enter the admin password to continue.");
      return;
    }

    setLoggingIn(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "x-admin-key": adminKey }
      });
      const result = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Invalid admin password.");
        return;
      }

      window.localStorage.setItem(adminStorageKey, adminKey);
      window.sessionStorage.setItem(adminSessionKey, "true");
      setIsSignedIn(true);
      setActiveTab("dashboard");
    } catch {
      setMessage("Could not reach the admin login backend.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    window.sessionStorage.removeItem(adminSessionKey);
    setIsSignedIn(false);
    setProducts([]);
    setSelectedId("");
    setMessage("");
  }

  useEffect(() => {
    if (isSignedIn && activeTab === "products" && products.length === 0) {
      loadProducts("");
    }
    if (isSignedIn && activeTab === "categories" && categories.length === 0) {
      loadCategories();
    }
    if (isSignedIn && activeTab === "discounts" && discounts.length === 0) {
      loadDiscounts();
    }
    if (isSignedIn && activeTab === "orders") {
      loadOrders();
    }
    if (isSignedIn && activeTab === "shipping" && !shippingSettings) {
      loadShippingSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSignedIn]);

  if (!isSignedIn) {
    return (
      <section className="midnight-band min-h-[42rem] px-4 py-16 text-ivory sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-champagne">Secure Admin</p>
          <h1 className="mt-4 font-display text-5xl">Admin Login</h1>
          <p className="mt-4 text-lg leading-8 text-ivory/75">
            Sign in to manage product photos, storefront copy, category labels, and synced Epos catalog settings.
          </p>
          <form className="mt-8 rounded-lg border border-champagne/30 bg-ink/75 p-6 shadow-luxe" onSubmit={handleLogin}>
            <label className="grid gap-2 text-sm font-semibold text-ivory">
              Admin Password
              <span className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-champagne" />
                <input
                  autoFocus
                  className="focus-ring min-h-14 w-full rounded-md border border-champagne/25 bg-espresso/80 pl-11 pr-4 text-ivory placeholder:text-ivory/45"
                  onChange={(event) => setAdminKey(event.target.value)}
                  placeholder="Admin Password"
                  type="password"
                  value={adminKey}
                />
              </span>
            </label>
            <button className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-champagne px-7 py-3 text-xs font-bold uppercase tracking-[0.18em] text-ink hover:bg-ivory" disabled={loggingIn} type="submit">
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loggingIn ? "Signing In" : "Sign In"}
            </button>
            {message ? <p className="mt-4 text-sm font-semibold text-champagne">{message}</p> : null}
          </form>
        </div>
      </section>
    );
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadProducts(query);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct && !isCreatingProduct) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const isNewProduct = isCreatingProduct;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/products", {
        method: isNewProduct ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({
          eposProductId: selectedProduct?.epos_product_id,
          marketingTitle: String(form.get("marketingTitle") || ""),
          marketingDescription: String(form.get("marketingDescription") || ""),
          department: String(form.get("department") || ""),
          isFeatured: form.get("isFeatured") === "on",
          isHidden: form.get("isHidden") === "on",
          eposName: String(form.get("eposName") || ""),
          eposDescription: String(form.get("eposDescription") || ""),
          eposSku: String(form.get("eposSku") || ""),
          eposSalePrice: String(form.get("eposSalePrice") || ""),
          eposStock: String(form.get("eposStock") || "")
        })
      });
      const result = (await response.json()) as { ok: boolean; message?: string; productId?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not save product details.");
        return;
      }

      setMessage(result.message || "Product website details saved.");
      if (isNewProduct) {
        setIsCreatingProduct(false);
        if (result.productId) {
          setSelectedId(result.productId);
        }
      }
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to the admin save backend.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = editingCategoryId;
    const payload = {
      id,
      label: String(form.get("label") || ""),
      href: String(form.get("href") || ""),
      parentId: form.get("parentId") ? Number(form.get("parentId")) : null,
      sortOrder: Number(form.get("sortOrder") || 0),
      isHeader: form.get("isHeader") === "on",
      syncToEpos: form.get("syncToEpos") === "on"
    };

    try {
      const response = await fetch("/api/admin/categories", {
        method: id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { ok: boolean; message?: string };

      setMessage(result.message || (result.ok ? "Category saved." : "Could not save category."));
      if (result.ok) {
        event.currentTarget.reset();
        setEditingCategoryId(null);
        setIsCategoryModalOpen(false);
        await loadCategories();
      }
    } catch {
      setMessage("Could not connect to the category save backend.");
    }
  }

  async function handleDeleteCategory(id: number) {
    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; message?: string };
      setMessage(result.message || (result.ok ? "Category removed." : "Could not remove category."));
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setIsCategoryModalOpen(false);
      }
      await loadCategories();
    } catch {
      setMessage("Could not connect to the category delete backend.");
    }
  }

  async function handleDiscountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/discounts", {
        method: editingDiscountId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({
          id: editingDiscountId,
          code: String(form.get("code") || ""),
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          discountType: String(form.get("discountType") || "percentage"),
          value: String(form.get("value") || ""),
          minimumOrderAmount: String(form.get("minimumOrderAmount") || ""),
          usageLimit: String(form.get("usageLimit") || ""),
          startsAt: String(form.get("startsAt") || ""),
          endsAt: String(form.get("endsAt") || ""),
          isActive: form.get("isActive") === "on",
          syncToEpos: true
        })
      });
      const result = (await response.json()) as { ok: boolean; message?: string };

      setMessage(result.message || (result.ok ? "Discount saved." : "Could not save discount."));
      if (result.ok) {
        event.currentTarget.reset();
        setEditingDiscountId(null);
        await loadDiscounts();
      }
    } catch {
      setMessage("Could not connect to the discount save backend.");
    }
  }

  async function handleDeleteDiscount(id: number) {
    try {
      const response = await fetch(`/api/admin/discounts?id=${id}`, {
        method: "DELETE",
        headers: adminKey ? { "x-admin-key": adminKey } : {}
      });
      const result = (await response.json()) as { ok: boolean; message?: string };
      setMessage(result.message || (result.ok ? "Discount removed." : "Could not remove discount."));
      if (editingDiscountId === id) {
        setEditingDiscountId(null);
      }
      await loadDiscounts();
    } catch {
      setMessage("Could not connect to the discount delete backend.");
    }
  }

  async function handleShippingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingShipping(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({
          originPostalCode: String(form.get("originPostalCode") || ""),
          freeShippingThreshold: String(form.get("freeShippingThreshold") || ""),
          baseRate: String(form.get("baseRate") || ""),
          perItemRate: String(form.get("perItemRate") || ""),
          texasRate: String(form.get("texasRate") || ""),
          remoteRate: String(form.get("remoteRate") || ""),
          syncToEpos: true
        })
      });
      const result = (await response.json()) as { ok: boolean; message?: string; settings?: ShippingSettings };

      setMessage(result.message || (result.ok ? "Shipping settings saved." : "Could not save shipping settings."));
      if (result.ok) {
        setShippingSettings(result.settings || null);
      }
    } catch {
      setMessage("Could not connect to the shipping save backend.");
    } finally {
      setSavingShipping(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setUploading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/products/${selectedProduct.epos_product_id}/images`, {
        method: "POST",
        headers: adminKey ? { "x-admin-key": adminKey } : {},
        body: form
      });
      const result = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not upload the product photo.");
        return;
      }

      setMessage("Product photo uploaded and set as primary.");
      event.currentTarget.reset();
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to Blob storage upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleImportEposImages() {
    setImportingImages(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/import-epos-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({ skipExisting: true, limit: 8 })
      });
      const text = await response.text();
      let result: {
        ok: boolean;
        message?: string;
        result?: {
          productsScanned: number;
          eposImageRecordsFound?: number;
          eposImageRecordsMatched?: number;
          blobImagesFound?: number;
          blobImagesMatched?: number;
          blobImagesAlreadyLinked?: number;
          blobImagesLinked?: number;
          blobImagesUnmatched?: number;
          blobImageRepairError?: string | null;
          imageUrlsFound: number;
          uploaded: number;
          skippedExisting: number;
          skippedDuplicate: number;
          failed: number;
          remainingWithoutPhotos: number;
        };
      };

      try {
        result = JSON.parse(text);
      } catch {
        setMessage(`Epos image import returned an unexpected response: ${text.slice(0, 180) || response.statusText}`);
        return;
      }

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not import Epos product images.");
        return;
      }

      const counts = result.result;
      setMessage(
        counts
          ? `${result.message} Blob scan found ${counts.blobImagesFound ?? 0} existing image file${counts.blobImagesFound === 1 ? "" : "s"}: ${counts.blobImagesMatched ?? 0} matched products, ${counts.blobImagesAlreadyLinked ?? 0} already linked, ${counts.blobImagesLinked ?? 0} newly linked, ${counts.blobImagesUnmatched ?? 0} unmatched. Epos image records: ${counts.eposImageRecordsFound ?? 0} found, ${counts.eposImageRecordsMatched ?? 0} matched. Found ${counts.imageUrlsFound} image URL${counts.imageUrlsFound === 1 ? "" : "s"}, skipped ${counts.skippedExisting} existing, failed ${counts.failed}. ${counts.remainingWithoutPhotos} product${counts.remainingWithoutPhotos === 1 ? "" : "s"} still have no photo.${counts.blobImageRepairError ? ` Blob scan error: ${counts.blobImageRepairError}` : ""}`
          : result.message || "Epos image import complete."
      );
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to the Epos image import backend.");
    } finally {
      setImportingImages(false);
    }
  }

  async function handleSyncEposCatalog() {
    setSyncingCatalog(true);
    setMessage("");

    try {
      const response = await fetch("/api/epos/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({ importImages: false })
      });
      const text = await response.text();
      let result: {
        ok: boolean;
        message?: string;
        products?: number;
        stock?: number;
        images?: {
          productsScanned: number;
          eposImageRecordsFound?: number;
          eposImageRecordsMatched?: number;
          blobImagesFound?: number;
          blobImagesMatched?: number;
          blobImagesAlreadyLinked?: number;
          blobImagesLinked?: number;
          blobImagesUnmatched?: number;
          blobImageRepairError?: string | null;
          imageUrlsFound: number;
          uploaded: number;
          skippedExisting: number;
          skippedDuplicate: number;
          failed: number;
          remainingWithoutPhotos: number;
        };
      };

      try {
        result = JSON.parse(text);
      } catch {
        setMessage(`Epos catalog sync returned an unexpected response: ${text.slice(0, 180) || response.statusText}`);
        return;
      }

      if (!response.ok || !result.ok) {
        setMessage(result.message || `Could not sync Epos catalog. HTTP ${response.status}`);
        return;
      }

      const imageText = result.images
        ? ` Blob scan found ${result.images.blobImagesFound ?? 0} existing image file${result.images.blobImagesFound === 1 ? "" : "s"}: ${result.images.blobImagesMatched ?? 0} matched products, ${result.images.blobImagesAlreadyLinked ?? 0} already linked, ${result.images.blobImagesLinked ?? 0} newly linked, ${result.images.blobImagesUnmatched ?? 0} unmatched. Epos image records: ${result.images.eposImageRecordsFound ?? 0} found, ${result.images.eposImageRecordsMatched ?? 0} matched. Uploaded ${result.images.uploaded} image${result.images.uploaded === 1 ? "" : "s"} from ${result.images.imageUrlsFound} URL${result.images.imageUrlsFound === 1 ? "" : "s"}; ${result.images.remainingWithoutPhotos} product${result.images.remainingWithoutPhotos === 1 ? "" : "s"} still have no photo.${result.images.blobImageRepairError ? ` Blob scan error: ${result.images.blobImageRepairError}` : ""}`
        : "";
      setMessage(`Epos sync complete. Pulled ${result.products || 0} products and ${result.stock || 0} stock record${result.stock === 1 ? "" : "s"}.${imageText} Use Import Epos Images separately for photo repair/import.`);
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to the Epos catalog sync backend.");
    } finally {
      setSyncingCatalog(false);
    }
  }

  async function handleRepairStock() {
    setRepairingStock(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/products/stock/fill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({ minimumStock: 1, limit: 500 })
      });
      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        result?: {
          updated: number;
          storefrontOverrides: number;
          failed: number;
          remainingBelowMinimum: number;
          failures?: Array<{ productId: string; name: string; message: string }>;
        };
      };

      if (!response.ok && !result.result) {
        setMessage(result.message || "Could not repair Epos stock.");
        return;
      }

      const counts = result.result;
      const preview = counts?.failures?.slice(0, 2).map((failure) => `${failure.name}: ${failure.message}`).join(" ");
      setMessage(
        counts
          ? `${result.message} Epos failures: ${counts.failed}.${preview ? ` ${preview}` : ""}`
          : result.message || "Stock repair complete."
      );
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to the stock repair backend.");
    } finally {
      setRepairingStock(false);
    }
  }

  return (
    <section className="midnight-band min-h-screen px-4 py-10 text-ivory sm:px-6 2xl:px-10">
      <div className="mx-auto w-full max-w-[112rem]">
        <div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-champagne">Admin</p>
            <h1 className="mt-3 font-display text-5xl">Admin Dashboard</h1>
            <p className="mt-3 max-w-3xl text-ivory/75">Manage catalog presentation, website content, product photos, and synced Epos storefront settings.</p>
          </div>
        </div>

        {message ? <div className="mt-6 rounded-lg border border-champagne/25 bg-ink/75 px-5 py-4 text-sm font-semibold text-champagne">{message}</div> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="flex min-h-[38rem] flex-col rounded-lg border border-champagne/25 bg-ink/80 p-4 shadow-luxe">
            <p className="px-3 text-xs font-bold uppercase tracking-[0.22em] text-champagne">Admin</p>
            <nav className="mt-4 grid gap-1">
              {adminTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    className={`focus-ring flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold ${activeTab === tab.id ? "bg-champagne/20 text-ivory" : "text-ivory/75 hover:bg-ivory/10 hover:text-ivory"}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    <Icon className="h-4 w-4 text-champagne" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <button className="focus-ring mt-auto rounded-full border border-champagne/50 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink" onClick={handleLogout} type="button">
              Logout
            </button>
          </aside>

          <section className="min-w-0 rounded-lg border border-champagne/25 bg-ink/75 p-5 shadow-luxe">
            {activeTab === "dashboard" ? (
              <div>
                <h2 className="font-display text-4xl">Dashboard</h2>
                <p className="mt-2 text-ivory/70">Choose a workspace from the admin menu.</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                  <button className="focus-ring rounded-lg border border-champagne/25 bg-ivory/5 p-5 text-left hover:bg-ivory/10" onClick={() => setActiveTab("products")} type="button">
                    <Package className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Products</p>
                    <p className="mt-2 text-sm text-ivory/65">{products.length || "Live"} Epos products, photo uploads, and storefront copy.</p>
                  </button>
                  <button className="focus-ring rounded-lg border border-champagne/25 bg-ivory/5 p-5 text-left hover:bg-ivory/10" onClick={() => setActiveTab("categories")} type="button">
                    <Tags className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Categories</p>
                    <p className="mt-2 text-sm text-ivory/65">{shopDepartments.length} storefront departments mapped to synced products.</p>
                  </button>
                  <button className="focus-ring rounded-lg border border-champagne/25 bg-ivory/5 p-5 text-left hover:bg-ivory/10" onClick={() => setActiveTab("orders")} type="button">
                    <ShoppingBag className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Orders</p>
                    <p className="mt-2 text-sm text-ivory/65">Website checkout submissions, shipping, and Epos sync status.</p>
                  </button>
                  <button className="focus-ring rounded-lg border border-champagne/25 bg-ivory/5 p-5 text-left hover:bg-ivory/10" onClick={() => setActiveTab("settings")} type="button">
                    <Settings className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Settings</p>
                    <p className="mt-2 text-sm text-ivory/65">Storefront configuration and admin options.</p>
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab !== "dashboard" && activeTab !== "products" ? (
              <div className="min-h-[34rem] rounded-lg border border-champagne/25 bg-ivory/5 p-5">
                <h2 className="font-display text-4xl">{adminTabs.find((tab) => tab.id === activeTab)?.label}</h2>
                {activeTab === "orders" ? (
                  <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-3xl text-sm leading-6 text-ivory/70">Orders submitted from the storefront are saved in Neon and sent to Epos with product lines and website shipping.</p>
                      <button className="focus-ring rounded-md border border-champagne/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink" onClick={loadOrders} type="button">
                        Refresh
                      </button>
                    </div>
                    <div className="mt-5 grid gap-4">
                      {!orders.length ? (
                        <div className="rounded-lg border border-dashed border-champagne/25 bg-ink/50 p-6 text-center text-sm text-ivory/60">No website orders yet.</div>
                      ) : null}
                      {orders.map((order) => (
                        <article className="rounded-lg border border-champagne/25 bg-ink/50 p-4" key={order.id}>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">{order.order_number}</p>
                              <p className="mt-2 font-display text-3xl">{order.customer_name}</p>
                              <p className="mt-1 text-sm text-ivory/65">{order.customer_email}{order.customer_phone ? ` / ${order.customer_phone}` : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-3xl">${Number(order.total).toFixed(2)}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ivory/55">{new Date(order.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 text-sm text-ivory/70 md:grid-cols-4">
                            <div className="rounded-md border border-champagne/15 bg-ivory/5 p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">Subtotal</p>
                              <p className="mt-1 font-semibold text-ivory">${Number(order.subtotal).toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-champagne/15 bg-ivory/5 p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">Shipping</p>
                              <p className="mt-1 font-semibold text-ivory">{order.shipping_service} / ${Number(order.shipping_amount).toFixed(2)}</p>
                            </div>
                            <div className="rounded-md border border-champagne/15 bg-ivory/5 p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">Epos</p>
                              <p className="mt-1 font-semibold text-ivory">{order.epos_order_id ? `Order ${order.epos_order_id}` : order.epos_sync_status}</p>
                            </div>
                            <div className="rounded-md border border-champagne/15 bg-ivory/5 p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">Status</p>
                              <p className="mt-1 font-semibold text-ivory">{order.status}</p>
                            </div>
                          </div>
                          {order.epos_sync_message ? <p className="mt-3 text-sm text-champagne">{order.epos_sync_message}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                {activeTab === "categories" ? (
                  <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-3xl text-sm leading-6 text-ivory/70">Add, edit, nest, and sort the categories that power the public header dropdowns and shop links.</p>
                      <button
                        className="focus-ring rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setIsCategoryModalOpen(true);
                        }}
                        type="button"
                      >
                        Add Category
                      </button>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {categories.map((category) => (
                        <div className="rounded-lg border border-champagne/25 bg-ink/50 p-4" key={category.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-display text-2xl">{category.label}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-champagne">{category.is_header ? "Header tab" : category.parent_id ? "Subcategory" : "Top level"} / order {category.sort_order}</p>
                              <p className="mt-2 text-xs text-ivory/60">{category.href}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="focus-ring rounded-md bg-champagne px-3 py-2 text-xs font-bold text-ink"
                                onClick={() => {
                                  setEditingCategoryId(category.id);
                                  setIsCategoryModalOpen(true);
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button className="focus-ring rounded-md border border-ember/60 px-3 py-2 text-xs font-bold text-ember" onClick={() => handleDeleteCategory(category.id)} type="button">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {isCategoryModalOpen ? (
                      <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
                        <div className="max-h-[calc(100vh-4rem)] w-full max-w-xl overflow-auto rounded-lg border border-champagne/30 bg-ink p-5 shadow-luxe">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.22em] text-champagne">Category Setup</p>
                              <h3 className="mt-2 font-display text-4xl" id="category-modal-title">{selectedCategory ? "Edit Category" : "Add Category"}</h3>
                            </div>
                            <button
                              className="focus-ring rounded-md border border-champagne/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-champagne hover:bg-champagne hover:text-ink"
                              onClick={() => {
                                setEditingCategoryId(null);
                                setIsCategoryModalOpen(false);
                              }}
                              type="button"
                            >
                              Close
                            </button>
                          </div>
                          <form className="mt-5 grid gap-3" key={selectedCategory?.id || "new-category"} onSubmit={handleCategorySubmit}>
                            <label className="grid gap-2 text-sm font-semibold text-ivory">
                              Category name
                              <input className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedCategory?.label || ""} name="label" required />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold text-ivory">
                              Header / shop link
                              <input className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedCategory?.href || ""} name="href" placeholder="/shop#accessories" />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold text-ivory">
                              Parent category
                              <select className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedCategory?.parent_id || ""} name="parentId">
                                <option value="">Top level</option>
                                {categories.filter((category) => category.id !== selectedCategory?.id).map((category) => (
                                  <option key={category.id} value={category.id}>{category.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-2 text-sm font-semibold text-ivory">
                              Sort order
                              <input className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedCategory?.sort_order || 0} name="sortOrder" type="number" />
                            </label>
                            <label className="flex items-center gap-3 rounded-md border border-champagne/20 bg-ivory/5 px-3 py-3 text-sm font-semibold text-ivory">
                              <input defaultChecked={Boolean(selectedCategory?.is_header)} name="isHeader" type="checkbox" />
                              Show as main header tab
                            </label>
                            <label className="flex items-center gap-3 rounded-md border border-champagne/20 bg-ivory/5 px-3 py-3 text-sm font-semibold text-ivory">
                              <input name="syncToEpos" type="checkbox" />
                              Sync category change to Epos
                            </label>
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button className="focus-ring rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory" type="submit">
                                {selectedCategory ? "Save" : "Add"}
                              </button>
                              <button
                                className="focus-ring rounded-md border border-champagne/40 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink"
                                onClick={() => {
                                  setEditingCategoryId(null);
                                  setIsCategoryModalOpen(false);
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {activeTab === "discounts" ? (
                  <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
                    <form className="min-w-0 rounded-lg border border-champagne/25 bg-ink/50 p-6" key={selectedDiscount?.id || "new-discount"} onSubmit={handleDiscountSubmit}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-3xl">{selectedDiscount ? "Edit Discount" : "Create Discount"}</p>
                          <p className="mt-2 text-sm leading-6 text-ivory/65">Discount codes save to Neon and register a matching Epos discount reason automatically.</p>
                        </div>
                        {selectedDiscount ? (
                          <button className="focus-ring rounded-md border border-champagne/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-champagne hover:bg-champagne hover:text-ink" onClick={() => setEditingDiscountId(null)} type="button">
                            New
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Code
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 uppercase text-ink" defaultValue={selectedDiscount?.code || ""} name="code" placeholder="WELCOME10" required />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Type
                            <select className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.discount_type || "percentage"} name="discountType">
                              <option value="percentage">Percentage</option>
                              <option value="fixed">Fixed amount</option>
                            </select>
                          </label>
                        </div>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                          Discount name
                          <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.name || ""} name="name" placeholder="New customer welcome" required />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                          Description
                          <textarea className="focus-ring min-h-24 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 py-3 text-ink" defaultValue={selectedDiscount?.description || ""} name="description" placeholder="Internal note or customer-facing context" />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Value
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.value || ""} min="0" name="value" step="0.01" type="number" required />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Min order
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.minimum_order_amount || ""} min="0" name="minimumOrderAmount" step="0.01" type="number" />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Usage limit
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.usage_limit || ""} min="1" name="usageLimit" step="1" type="number" />
                          </label>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Starts
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.starts_at?.slice(0, 10) || ""} name="startsAt" type="date" />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Ends
                            <input className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={selectedDiscount?.ends_at?.slice(0, 10) || ""} name="endsAt" type="date" />
                          </label>
                        </div>
                        <label className="flex items-center gap-3 rounded-md border border-champagne/20 bg-ivory/5 px-3 py-3 text-sm font-semibold text-ivory">
                          <input defaultChecked={selectedDiscount ? selectedDiscount.is_active : true} name="isActive" type="checkbox" />
                          Active on website
                        </label>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button className="focus-ring rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory" type="submit">
                            {selectedDiscount ? "Save" : "Create"}
                          </button>
                          {selectedDiscount ? (
                            <button className="focus-ring rounded-md border border-champagne/40 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink" onClick={() => setEditingDiscountId(null)} type="button">
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </form>
                    <div className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {!discounts.length ? (
                        <div className="rounded-lg border border-dashed border-champagne/25 bg-ink/50 p-6 text-center text-sm text-ivory/60 md:col-span-2 2xl:col-span-3">No discount codes yet.</div>
                      ) : null}
                      {discounts.map((discount) => (
                        <div className="rounded-lg border border-champagne/25 bg-ink/50 p-4" key={discount.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">{discount.code}</p>
                              <p className="mt-2 font-display text-2xl">{discount.name}</p>
                              <p className="mt-2 text-sm text-ivory/70">
                                {discount.discount_type === "percentage" ? `${Number(discount.value)}% off` : `$${Number(discount.value).toFixed(2)} off`}
                                {discount.minimum_order_amount ? ` / min $${Number(discount.minimum_order_amount).toFixed(2)}` : ""}
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ivory/45">
                                {discount.is_active ? "Active" : "Inactive"} / {discount.epos_discount_reason_id ? `Epos ${discount.epos_discount_reason_id}` : "Epos not registered"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button className="focus-ring rounded-md bg-champagne px-3 py-2 text-xs font-bold text-ink" onClick={() => setEditingDiscountId(discount.id)} type="button">Edit</button>
                              <button className="focus-ring rounded-md border border-ember/60 px-3 py-2 text-xs font-bold text-ember" onClick={() => handleDeleteDiscount(discount.id)} type="button">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {activeTab === "shipping" ? (
                  <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
                    <form className="min-w-0 rounded-lg border border-champagne/25 bg-ink/50 p-6" key={shippingSettings?.epos_shipping_product_id || "shipping-settings"} onSubmit={handleShippingSubmit}>
                      <p className="font-display text-3xl">Shipping Calculator</p>
                      <p className="mt-2 text-sm leading-6 text-ivory/65">Customers enter a US shipping address in the cart. The site calculates shipping from these rules and keeps an Epos shipping product ready for checkout orders.</p>
                      <div className="mt-5 grid gap-4">
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                          Origin ZIP
                          <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.origin_postal_code || "75785"} name="originPostalCode" />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Free shipping over
                            <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.free_shipping_threshold || "150.00"} min="0" name="freeShippingThreshold" step="0.01" type="number" />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Standard base rate
                            <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.base_rate || "8.95"} min="0" name="baseRate" step="0.01" type="number" />
                          </label>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Per extra item
                            <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.per_item_rate || "1.25"} min="0" name="perItemRate" step="0.01" type="number" />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            Texas rate
                            <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.texas_rate || "7.95"} min="0" name="texasRate" step="0.01" type="number" />
                          </label>
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-ivory">
                            AK / HI rate
                            <input className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory px-3 text-ink" defaultValue={shippingSettings?.remote_rate || "19.95"} min="0" name="remoteRate" step="0.01" type="number" />
                          </label>
                        </div>
                        <button className="focus-ring w-fit rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory disabled:opacity-60" disabled={savingShipping} type="submit">
                          {savingShipping ? "Saving" : "Save Shipping"}
                        </button>
                      </div>
                    </form>
                    <div className="grid content-start gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5">
                        <p className="font-display text-3xl">Customer Address</p>
                        <p className="mt-2 text-sm text-ivory/65">The cart panel now collects street, city, state, ZIP, and country before showing the shipping amount.</p>
                      </div>
                      <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5">
                        <p className="font-display text-3xl">Epos Status</p>
                        <p className="mt-2 text-sm text-ivory/65">{shippingSettings?.epos_shipping_product_id ? `Website Shipping product ID ${shippingSettings.epos_shipping_product_id}` : "Save settings to create the Website Shipping product in Epos."}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {activeTab === "content" ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {["Shipping & Returns", "Privacy Policy", "Contact Details", "Homepage Sections"].map((item) => (
                      <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5" key={item}>
                        <p className="font-display text-3xl">{item}</p>
                        <p className="mt-2 text-sm text-ivory/65">Content workspace for future text editing and publishing controls.</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {activeTab === "settings" ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">Photos</p>
                      <p className="mt-3 font-display text-4xl">{productStats.withPhotos}</p>
                      <p className="mt-2 text-sm text-ivory/65">Products with uploaded website photos.</p>
                    </div>
                    <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">Featured</p>
                      <p className="mt-3 font-display text-4xl">{productStats.featured}</p>
                      <p className="mt-2 text-sm text-ivory/65">Products marked as featured.</p>
                    </div>
                    <div className="rounded-lg border border-champagne/25 bg-ink/50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">Hidden</p>
                      <p className="mt-3 font-display text-4xl">{productStats.hidden}</p>
                      <p className="mt-2 text-sm text-ivory/65">Products hidden from the public shop.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "products" ? (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-4xl">Products</h2>
                    <p className="mt-2 text-ivory/70">Manage Epos-synced products, photos, and website presentation.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="focus-ring rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={syncingCatalog}
                      onClick={handleSyncEposCatalog}
                      type="button"
                    >
                      {syncingCatalog ? "Syncing" : "Sync Epos Catalog"}
                    </button>
                    <button
                      className="focus-ring rounded-md border border-champagne/45 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={importingImages || syncingCatalog}
                      onClick={handleImportEposImages}
                      type="button"
                    >
                      {importingImages ? "Importing" : "Import Epos Images"}
                    </button>
                    <button
                      className="focus-ring rounded-md border border-champagne/45 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-champagne hover:bg-champagne hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={repairingStock || syncingCatalog}
                      onClick={handleRepairStock}
                      type="button"
                    >
                      {repairingStock ? "Updating Stock" : "Set Stock Minimum"}
                    </button>
                    <button
                      className="focus-ring rounded-md bg-champagne px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory"
                      onClick={() => {
                        setIsCreatingProduct(true);
                        setSelectedId("");
                        setMessage("");
                      }}
                      type="button"
                    >
                      Add Product
                    </button>
                  </div>
                </div>
                {message ? (
                  <div className="mt-4 rounded-lg border border-champagne/25 bg-ink/85 px-4 py-3 text-sm font-semibold text-champagne" role="status">
                    {message}
                  </div>
                ) : null}
                <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
                  <aside className="rounded-lg border border-champagne/20 bg-ink/80 p-4">
            <form className="flex gap-2" onSubmit={handleSearch}>
              <label className="relative flex-1">
                <span className="sr-only">Search products</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-saddle" />
                <input
                  className="focus-ring min-h-11 w-full rounded-md border border-champagne/20 bg-ivory pl-10 pr-3 text-sm text-ink"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Epos catalog"
                  value={query}
                />
              </label>
              <button className="focus-ring rounded-md bg-champagne px-4 text-xs font-bold uppercase tracking-[0.14em] text-ink" type="submit">
                Go
              </button>
            </form>

            <div className="mt-4 max-h-[44rem] overflow-auto pr-1">
              {loading ? (
                <div className="flex items-center gap-2 rounded-md bg-ivory/10 p-4 text-sm text-ivory/75">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products
                </div>
              ) : null}
              {!loading && !products.length ? (
                <div className="rounded-md border border-dashed border-champagne/30 p-5 text-center text-sm text-ivory/70">No products found.</div>
              ) : null}
              <div className="grid gap-2">
                {products.map((product) => (
                  <button
                    className={`focus-ring rounded-md border p-3 text-left transition ${selectedProduct?.epos_product_id === product.epos_product_id ? "border-champagne bg-champagne/15" : "border-champagne/10 bg-ivory/5 hover:bg-ivory/10"}`}
                    key={product.epos_product_id}
                    onClick={() => {
                      setIsCreatingProduct(false);
                      setSelectedId(product.epos_product_id);
                    }}
                    type="button"
                  >
                    <span className="line-clamp-2 font-semibold text-ivory">{product.marketing_title || product.name}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-champagne">{product.sku || "No SKU"} / {money(product.sale_price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {selectedProduct || isCreatingProduct ? (
            <div className="grid gap-6 2xl:grid-cols-[minmax(36rem,1fr)_28rem]">
              <form className="rounded-lg border border-champagne/20 bg-ivory p-5 text-ink shadow-luxe" key={selectedProduct?.epos_product_id || "new-product"} onSubmit={handleSave}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">Website Product</p>
                    <h2 className="mt-2 font-display text-4xl text-ink">{isCreatingProduct ? "New Product" : selectedProduct?.marketing_title || selectedProduct?.name}</h2>
                    <p className="mt-2 text-sm text-espresso/65">
                      {isCreatingProduct ? "Create in Epos first, then cache the product in Neon." : `Epos ID ${selectedProduct?.epos_product_id} / SKU ${selectedProduct?.sku || "Not set"} / ${money(selectedProduct?.sale_price || null)}`}
                    </p>
                  </div>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle" disabled={saving} type="submit">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isCreatingProduct ? "Create" : "Save"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Epos product name
                    <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct?.name || ""} name="eposName" required />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Epos product description
                    <textarea className="focus-ring min-h-24 rounded-md border border-saddle/20 bg-white px-4 py-3 font-normal" defaultValue={selectedProduct?.description || ""} name="eposDescription" />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-espresso">
                      Epos SKU
                      <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct?.sku || ""} name="eposSku" />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-espresso">
                      Epos price
                      <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct?.sale_price || ""} name="eposSalePrice" step="0.01" type="number" />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-espresso">
                      Epos stock
                      <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={adminStockValue(selectedProduct)} name="eposStock" step="1" type="number" />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Storefront title
                    <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct?.marketing_title || ""} name="marketingTitle" placeholder={selectedProduct?.name || "Customer-facing title"} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Storefront description
                    <textarea className="focus-ring min-h-32 rounded-md border border-saddle/20 bg-white px-4 py-3 font-normal" defaultValue={selectedProduct?.marketing_description || ""} name="marketingDescription" placeholder={selectedProduct?.description || "Short customer-facing product description"} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Website department
                    <select className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct?.department || ""} name="department">
                      <option value="">Auto categorize</option>
                      {shopDepartments.map((department) => (
                        <option key={department.id} value={department.id}>{department.title}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-saddle/15 bg-white px-4 text-sm font-semibold text-espresso">
                      <input defaultChecked={Boolean(selectedProduct?.is_featured)} name="isFeatured" type="checkbox" />
                      <Star className="h-4 w-4 text-saddle" />
                      Featured product
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-saddle/15 bg-white px-4 text-sm font-semibold text-espresso">
                      <input defaultChecked={Boolean(selectedProduct?.is_hidden)} name="isHidden" type="checkbox" />
                      <EyeOff className="h-4 w-4 text-saddle" />
                      Hide from shop
                    </label>
                  </div>
                  {isCreatingProduct ? (
                    <button className="focus-ring rounded-md border border-saddle/25 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-saddle hover:bg-saddle hover:text-ivory" onClick={() => setIsCreatingProduct(false)} type="button">
                      Cancel New Product
                    </button>
                  ) : null}
                </div>
              </form>

              <aside className="rounded-lg border border-champagne/20 bg-ink/80 p-5 shadow-luxe" key={`${selectedProduct?.epos_product_id || "new-product"}-photos`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">Product Photos</p>
                <div className="mt-4 overflow-hidden rounded-lg border border-champagne/20 bg-ivory/5">
                  {selectedProduct?.primary_image_url ? (
                    <Image
                      alt={selectedProduct.primary_image_alt || selectedProduct.name}
                      className="aspect-square w-full object-cover"
                      height={700}
                      src={selectedProduct.primary_image_url}
                      width={700}
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-center text-ivory/65">
                      <div>
                        <Camera className="mx-auto h-10 w-10 text-champagne" />
                        <p className="mt-3 text-sm font-semibold">No photo uploaded yet</p>
                      </div>
                    </div>
                  )}
                </div>
                <form className="mt-5 grid gap-3" onSubmit={handleUpload}>
                  <label className="grid gap-2 text-sm font-semibold text-ivory">
                    Upload photo
                    <input accept="image/*" className="focus-ring rounded-md border border-champagne/20 bg-ivory px-3 py-3 text-sm text-ink disabled:opacity-60" disabled={isCreatingProduct} name="file" required type="file" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-ivory">
                    Alt text
                    <input className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-sm text-ink disabled:opacity-60" disabled={isCreatingProduct} name="altText" placeholder={selectedProduct?.name || "Save the product before uploading photos"} />
                  </label>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-champagne px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-60" disabled={uploading || isCreatingProduct} type="submit">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Upload
                  </button>
                </form>
              </aside>
            </div>
          ) : (
            <div className="grid min-h-96 place-items-center rounded-lg border border-dashed border-champagne/25 bg-ink/60 text-center">
              <div>
                <PackageSearch className="mx-auto h-10 w-10 text-champagne" />
                <p className="mt-3 font-display text-3xl">Select a product</p>
              </div>
            </div>
          )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}
