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
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
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

export function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedKey = window.localStorage.getItem(adminStorageKey) || "";
    const signedIn = window.sessionStorage.getItem(adminSessionKey) === "true";

    setAdminKey(storedKey);
    setIsSignedIn(Boolean(storedKey && signedIn));
  }, []);

  const selectedProduct = useMemo(() => products.find((product) => product.epos_product_id === selectedId) || products[0], [products, selectedId]);

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

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminKey.trim()) {
      setMessage("Enter the admin password to continue.");
      return;
    }

    window.localStorage.setItem(adminStorageKey, adminKey);
    window.sessionStorage.setItem(adminSessionKey, "true");
    setIsSignedIn(true);
    setMessage("");
    setActiveTab("dashboard");
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
            <button className="focus-ring mt-5 rounded-full bg-champagne px-7 py-3 text-xs font-bold uppercase tracking-[0.18em] text-ink hover:bg-ivory" type="submit">
              Sign In
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

    if (!selectedProduct) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {})
        },
        body: JSON.stringify({
          eposProductId: selectedProduct.epos_product_id,
          marketingTitle: String(form.get("marketingTitle") || ""),
          marketingDescription: String(form.get("marketingDescription") || ""),
          department: String(form.get("department") || ""),
          isFeatured: form.get("isFeatured") === "on",
          isHidden: form.get("isHidden") === "on"
        })
      });
      const result = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Could not save product details.");
        return;
      }

      setMessage(result.message || "Product website details saved.");
      await loadProducts(query);
    } catch {
      setMessage("Could not connect to the admin save backend.");
    } finally {
      setSaving(false);
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

  return (
    <section className="midnight-band min-h-screen px-4 py-12 text-ivory sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-champagne">Admin</p>
            <h1 className="mt-3 font-display text-5xl">Admin Dashboard</h1>
            <p className="mt-3 max-w-3xl text-ivory/75">Manage catalog presentation, website content, product photos, and synced Epos storefront settings.</p>
          </div>
        </div>

        {message ? <div className="mt-6 rounded-lg border border-champagne/25 bg-ink/75 px-5 py-4 text-sm font-semibold text-champagne">{message}</div> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[15rem_1fr]">
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

          <section className="rounded-lg border border-champagne/25 bg-ink/75 p-5 shadow-luxe">
            {activeTab === "dashboard" ? (
              <div>
                <h2 className="font-display text-4xl">Dashboard</h2>
                <p className="mt-2 text-ivory/70">Choose a workspace from the admin menu.</p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <button className="focus-ring rounded-lg border border-champagne/25 bg-ivory/5 p-5 text-left hover:bg-ivory/10" onClick={() => setActiveTab("products")} type="button">
                    <Package className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Products</p>
                    <p className="mt-2 text-sm text-ivory/65">Edit storefront copy and upload product photos.</p>
                  </button>
                  <div className="rounded-lg border border-champagne/25 bg-ivory/5 p-5">
                    <ShoppingBag className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Orders</p>
                    <p className="mt-2 text-sm text-ivory/65">Checkout/order tools will connect here next.</p>
                  </div>
                  <div className="rounded-lg border border-champagne/25 bg-ivory/5 p-5">
                    <Settings className="h-7 w-7 text-champagne" />
                    <p className="mt-4 font-display text-3xl">Settings</p>
                    <p className="mt-2 text-sm text-ivory/65">Storefront configuration and admin options.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab !== "dashboard" && activeTab !== "products" ? (
              <div className="grid min-h-[34rem] place-items-center rounded-lg border border-dashed border-champagne/25 text-center">
                <div>
                  <PackageSearch className="mx-auto h-10 w-10 text-champagne" />
                  <p className="mt-3 font-display text-3xl">{adminTabs.find((tab) => tab.id === activeTab)?.label}</p>
                  <p className="mt-2 text-sm text-ivory/65">This workspace is ready for the next ecommerce build step.</p>
                </div>
              </div>
            ) : null}

            {activeTab === "products" ? (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-4xl">Products</h2>
                    <p className="mt-2 text-ivory/70">Manage Epos-synced products, photos, and website presentation.</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-6 xl:grid-cols-[20rem_1fr]">
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
                    onClick={() => setSelectedId(product.epos_product_id)}
                    type="button"
                  >
                    <span className="line-clamp-2 font-semibold text-ivory">{product.marketing_title || product.name}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-champagne">{product.sku || "No SKU"} / {money(product.sale_price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {selectedProduct ? (
            <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
              <form className="rounded-lg border border-champagne/20 bg-ivory p-5 text-ink shadow-luxe" onSubmit={handleSave}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">Website Product</p>
                    <h2 className="mt-2 font-display text-4xl text-ink">{selectedProduct.marketing_title || selectedProduct.name}</h2>
                    <p className="mt-2 text-sm text-espresso/65">Epos ID {selectedProduct.epos_product_id} / SKU {selectedProduct.sku || "Not set"} / {money(selectedProduct.sale_price)}</p>
                  </div>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle" disabled={saving} type="submit">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Storefront title
                    <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct.marketing_title || ""} name="marketingTitle" placeholder={selectedProduct.name} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Storefront description
                    <textarea className="focus-ring min-h-32 rounded-md border border-saddle/20 bg-white px-4 py-3 font-normal" defaultValue={selectedProduct.marketing_description || ""} name="marketingDescription" placeholder={selectedProduct.description || "Short customer-facing product description"} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Website department
                    <select className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" defaultValue={selectedProduct.department || ""} name="department">
                      <option value="">Auto categorize</option>
                      {shopDepartments.map((department) => (
                        <option key={department.id} value={department.id}>{department.title}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-saddle/15 bg-white px-4 text-sm font-semibold text-espresso">
                      <input defaultChecked={Boolean(selectedProduct.is_featured)} name="isFeatured" type="checkbox" />
                      <Star className="h-4 w-4 text-saddle" />
                      Featured product
                    </label>
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-saddle/15 bg-white px-4 text-sm font-semibold text-espresso">
                      <input defaultChecked={Boolean(selectedProduct.is_hidden)} name="isHidden" type="checkbox" />
                      <EyeOff className="h-4 w-4 text-saddle" />
                      Hide from shop
                    </label>
                  </div>
                </div>
              </form>

              <aside className="rounded-lg border border-champagne/20 bg-ink/80 p-5 shadow-luxe">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-champagne">Product Photos</p>
                <div className="mt-4 overflow-hidden rounded-lg border border-champagne/20 bg-ivory/5">
                  {selectedProduct.primary_image_url ? (
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
                    <input accept="image/*" className="focus-ring rounded-md border border-champagne/20 bg-ivory px-3 py-3 text-sm text-ink" name="file" required type="file" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-ivory">
                    Alt text
                    <input className="focus-ring min-h-11 rounded-md border border-champagne/20 bg-ivory px-3 text-sm text-ink" name="altText" placeholder={selectedProduct.name} />
                  </label>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-champagne px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ink hover:bg-ivory" disabled={uploading} type="submit">
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
