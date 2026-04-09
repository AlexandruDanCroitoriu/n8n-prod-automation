"use client";

import { useState, useEffect } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

type Product = {
  row_number: number;
  product: string;
  "Drive Folder link": string;
  "Drive Sheets link": string;
};

type ProductUrlEntry = {
  URL: string;
  row_number: number;
  imageUrl: string;
  title?: string;
  content?: string;
  html?: string;
  images?: string[];
};

type ProductImage = {
  row_number: number;
  url: string;
};

type ProductMetafield = {
  row_number: number;
  Metafield: string;
  Type: string;
  value?: string;
};

type ProductDetail = {
  row_number: number;
  document_url: string;
  shopify_gid: string;
  product_title: string;
  urls: ProductUrlEntry[];
  images?: Array<{ items: ProductImage[] }>;
  metafields?: Array<{ items: ProductMetafield[] }>;
};

type Prompt = {
  row_number: number;
  [key: string]: unknown;
};

type Metafield = {
  [key: string]: unknown;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [settingLinks, setSettingLinks] = useState(false);
  const [productLinks, setProductLinks] = useState<string[]>([""]);
  const [setLinksLoading, setSetLinksLoading] = useState(false);
  const [setLinksError, setSetLinksError] = useState<string | null>(null);
  const [setLinksSuccess, setSetLinksSuccess] = useState(false);
  const [linkErrors, setLinkErrors] = useState<(string | null)[]>([null]);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<ProductUrlEntry | null>(null);
  const [fetchingData, setFetchingData] = useState<Set<string>>(new Set());
  const [fetchedUrls, setFetchedUrls] = useState<Set<string>>(new Set());
  const [viewInfoEntry, setViewInfoEntry] = useState<ProductUrlEntry | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [productLightboxIndex, setProductLightboxIndex] = useState<number>(-1);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [updatingImages, setUpdatingImages] = useState(false);
  const [updateImagesError, setUpdateImagesError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [viewPromptModal, setViewPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [savePromptError, setSavePromptError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "metafields">("products");
  const [metafields, setMetafields] = useState<Metafield[]>([]);
  const [metafieldsLoading, setMetafieldsLoading] = useState(false);
  const [metafieldsError, setMetafieldsError] = useState<string | null>(null);
  const [showImagesSidebar, setShowImagesSidebar] = useState(false);
  const [sidebarLightbox, setSidebarLightbox] = useState<{ entry: ProductUrlEntry; index: number } | null>(null);
  const [sidebarSelectedImages, setSidebarSelectedImages] = useState<Set<string>>(new Set());
  const [addingImages, setAddingImages] = useState(false);
  const [addImagesError, setAddImagesError] = useState<string | null>(null);
  const [editingMetafield, setEditingMetafield] = useState<number | null>(null);
  const [editMetafieldValue, setEditMetafieldValue] = useState("");
  const [savingMetafield, setSavingMetafield] = useState(false);
  const [saveMetafieldError, setSaveMetafieldError] = useState<string | null>(null);
  const [metafieldImageModal, setMetafieldImageModal] = useState(false);
  const [generatingMetafields, setGeneratingMetafields] = useState(false);
  const [generateMetafieldsError, setGenerateMetafieldsError] = useState<string | null>(null);

  async function generateProductData() {
    if (!selectedProduct || !productDetail) return;
    setGeneratingMetafields(true);
    setGenerateMetafieldsError(null);
    try {
      const setProductDataEntry = prompts.find((p) => "Set Product Data" in p) ?? null;
      const setProductDataPrompt = setProductDataEntry ? (setProductDataEntry["Set Product Data"] as string) ?? "" : "";
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "generateProductData",
          row_number: selectedProduct.row_number,
          product: selectedProduct.product,
          drive_folder: selectedProduct["Drive Folder link"],
          drive_sheet: selectedProduct["Drive Sheets link"],
          set_product_data_prompt: setProductDataPrompt,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.body ?? errData?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProductDetail(normalizeProductDetail(data));
    } catch (err) {
      setGenerateMetafieldsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGeneratingMetafields(false);
    }
  }

  async function fetchMetafields() {
    setMetafieldsLoading(true);
    setMetafieldsError(null);
    try {
      console.log("[metafields] request POST /api/metafields");
      const res = await fetch("/api/metafields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      console.log("[metafields] response", res.status, data);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load metafields");
      setMetafields(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setMetafieldsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMetafieldsLoading(false);
    }
  }

  async function fetchPrompts() {
    setPromptsLoading(true);
    try {
      console.log("[prompt] request GET /api/prompt");
      const res = await fetch("/api/prompt");
      const data = await res.json();
      console.log("[prompt] response", res.status, data);
      if (!res.ok) throw new Error(`Failed to load prompts: ${res.status} ${JSON.stringify(data)}`);
      setPrompts(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error("[prompts] error", err);
    } finally {
      setPromptsLoading(false);
    }
  }

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      console.log("[products]", data);
      setProducts(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function normalizeProductDetail(data: unknown): ProductDetail {
    const raw: ProductDetail = Array.isArray(data) ? data[0] : data as ProductDetail;
    const seenUrls = new Set<number>();
    const urls = (raw.urls ?? [])
      .filter((entry) => {
        if (seenUrls.has(entry.row_number)) return false;
        seenUrls.add(entry.row_number);
        return true;
      })
      .map((entry) => ({
        ...entry,
        images: Array.isArray(entry.images)
          ? entry.images
          : typeof entry.images === "string"
          ? (() => { try { return JSON.parse(entry.images as unknown as string); } catch { return (entry.images as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean); } })()
          : undefined,
      }));
    const images = raw.images?.map((group) => {
      const seenImgs = new Set<number>();
      return {
        ...group,
        items: group.items.filter((img) => {
          if (seenImgs.has(img.row_number)) return false;
          seenImgs.add(img.row_number);
          return true;
        }),
      };
    });
    return { ...raw, urls, images };
  }

  async function fetchProduct(product: Product) {
    setLoading(true);
    setError(null);
    setSelectedProduct(product);
    setSelectedImages(new Set());
    try {
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "get",
          row_number: product.row_number,
          product: product.product,
          drive_folder: product["Drive Folder link"],
          drive_sheet: product["Drive Sheets link"],
        }),
      });
      if (!res.ok) throw new Error("Failed to load product");
      const data = await res.json();
      console.log("[product]", data);
      setProductDetail(normalizeProductDetail(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function addImagesFromSidebar() {
    if (!productDetail || sidebarSelectedImages.size === 0) return;
    setAddingImages(true);
    setAddImagesError(null);
    try {
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "addImages",
          row_number: productDetail.row_number,
          product: selectedProduct!.product,
          drive_folder: selectedProduct!["Drive Folder link"],
          drive_sheet: selectedProduct!["Drive Sheets link"],
          images: Array.from(sidebarSelectedImages),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.body ?? errData?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const normalized = normalizeProductDetail(data);
      const existingByRowNumber = new Map(productDetail.urls.map((u) => [u.row_number, u]));
      normalized.urls = normalized.urls.map((u) => {
        const existing = existingByRowNumber.get(u.row_number);
        if (!existing) return u;
        // Response may strip scraped fields — preserve them from current state
        return {
          ...existing,
          ...Object.fromEntries(
            Object.entries(u).filter(([, v]) => v !== undefined && v !== null && v !== "")
          ),
          images: u.images ?? existing.images,
        };
      });
      setProductDetail(normalized);
      setSidebarSelectedImages(new Set());
    } catch (err) {
      setAddImagesError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingImages(false);
    }
  }

  async function updateMetafield(rowNumber: number, metafieldName: string, value: string) {
    if (!productDetail) return;
    setSavingMetafield(true);
    setSaveMetafieldError(null);
    try {
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "updateMetafields",
          row_number: productDetail.row_number,
          product: selectedProduct!.product,
          drive_folder: selectedProduct!["Drive Folder link"],
          drive_sheet: selectedProduct!["Drive Sheets link"],
          metafield_row_number: rowNumber,
          metafield: metafieldName,
          value,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.body ?? errData?.error ?? `HTTP ${res.status}`);
      }
      setProductDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          metafields: prev.metafields?.map((g) => ({
            ...g,
            items: g.items.map((mf) =>
              mf.row_number === rowNumber ? { ...mf, value } : mf
            ),
          })),
        };
      });
      setEditingMetafield(null);
    } catch (err) {
      setSaveMetafieldError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingMetafield(false);
    }
  }

  async function updateImages() {
    if (!productDetail || selectedImages.size === 0) return;
    setUpdatingImages(true);
    setUpdateImagesError(null);
    const allImages = (productDetail.images ?? []).flatMap((g) => g.items).filter((img) => !!img.url);
    const selected = allImages.filter((img) => selectedImages.has(img.row_number));
    try {
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "removeImages",
          row_number: productDetail.row_number,
          product: selectedProduct!.product,
          drive_folder: selectedProduct!["Drive Folder link"],
          drive_sheet: selectedProduct!["Drive Sheets link"],
          images: selected,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.body ?? errData?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProductDetail(normalizeProductDetail(data));
      setSelectedImages(new Set());
    } catch (err) {
      setUpdateImagesError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdatingImages(false);
    }
  }

  function goBack() {
    setSelectedProduct(null);
    setProductDetail(null);
    setError(null);
    setSettingLinks(false);
    setProductLinks([""]);
    setSetLinksError(null);
    setSetLinksSuccess(false);
    setLinkErrors([null]);
  }

  async function setProductLinksHandler(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;

    const trimmed = productLinks.map((l) => l.trim());
    const existingUrls = new Set((productDetail?.urls ?? []).map((u) => u.URL));
    const errors: (string | null)[] = trimmed.map((url, i) => {
      if (!url) return null;
      if (existingUrls.has(url)) return "Already added to this product";
      if (trimmed.indexOf(url) !== i) return "Duplicate in this list";
      return null;
    });
    if (errors.some((e) => e !== null)) {
      setLinkErrors(errors);
      return;
    }
    setLinkErrors(trimmed.map(() => null));
    setSetLinksLoading(true);
    setSetLinksError(null);
    setSetLinksSuccess(false);
    try {
      const body = {
          method: "addProductLinks",
          row_number: selectedProduct.row_number,
          product: selectedProduct.product,
          drive_folder: selectedProduct["Drive Folder link"],
          drive_sheet: selectedProduct["Drive Sheets link"],
          document_url: productDetail?.document_url,
          shopify_gid: productDetail?.shopify_gid,
          product_title: productDetail?.product_title,
          links: productLinks.filter((l) => l.trim()),
        };
      console.log("[add_product_links] request", body);
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add product links");
      const data = await res.json();
      console.log("[add_product_links] response", data);
      setProductDetail(normalizeProductDetail(data));
      setSettingLinks(false);
      setLinkErrors([null]);
      setSetLinksSuccess(true);
    } catch (err) {
      setSetLinksError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSetLinksLoading(false);
    }
  }

  async function fetchProductData(entry: ProductUrlEntry) {
    if (!selectedProduct) return;
    setFetchingData((prev) => new Set(prev).add(entry.URL));
    try {
      const dataExtractorEntry = prompts.find((p) => "Data Extractor" in p) ?? prompts[0];
      const dataExtractorPrompt = dataExtractorEntry ? (dataExtractorEntry["Data Extractor"] as string) ?? "" : "";
      const body = {
        method: "fetchProductUrlData",
        row_number: selectedProduct.row_number,
        product: selectedProduct.product,
        drive_folder: selectedProduct["Drive Folder link"],
        drive_sheet: selectedProduct["Drive Sheets link"],
        document_url: productDetail?.document_url,
        shopify_gid: productDetail?.shopify_gid,
        product_title: productDetail?.product_title,
        link_url: entry.URL,
        link_row_number: entry.row_number,
        data_extractor_prompt: dataExtractorPrompt,
      };
      console.log("[fetch-product-url-data] request", body);
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to fetch product data");
      const data = await res.json();
      console.log("[fetch-product-url-data] response", data);
      setProductDetail(normalizeProductDetail(data));
      setFetchedUrls((prev) => new Set(prev).add(entry.URL));
    } catch {
      // silently fail — button just won't turn green
    } finally {
      setFetchingData((prev) => { const next = new Set(prev); next.delete(entry.URL); return next; });
    }
  }

  async function deleteProductLink(entry: ProductUrlEntry) {
    if (!selectedProduct) return;
    setConfirmEntry(null);
    setDeletingLink(entry.URL);
    setDeleteError(null);
    try {
      const deleteBody = {
          method: "removeProductLink",
          row_number: selectedProduct.row_number,
          product: selectedProduct.product,
          drive_folder: selectedProduct["Drive Folder link"],
          drive_sheet: selectedProduct["Drive Sheets link"],
          link_row_number: entry.row_number,
          link_url: entry.URL,
          link_imageUrl: entry.imageUrl,
        };
      console.log("[delete-product-link] request", deleteBody);
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteBody),
      });
      if (!res.ok) throw new Error("Failed to delete link");
      const deleteData = await res.json();
      console.log("[delete-product-link] response", deleteData);
      setProductDetail(normalizeProductDetail(deleteData));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingLink(null);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const createBody = { name: newProductName.trim() };
      console.log("[product-create] request", createBody);
      const res = await fetch("/api/product-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      if (!res.ok) throw new Error("Failed to create product");
      const createData = await res.json();
      console.log("[product-create] response", createData);
      setCreating(false);
      setNewProductName("");
      await fetchProducts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreateLoading(false);
    }
  }

  function refresh() {
    if (selectedProduct) {
      fetchProduct(selectedProduct);
    } else {
      fetchProducts();
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchPrompts();
    fetchMetafields();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-800 to-gray-900 flex items-stretch justify-center p-6 gap-4">
      <div className="flex-1 min-w-0 max-w-400 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold">
            <button
              onClick={() => { setActiveTab("products"); if (selectedProduct) goBack(); else fetchProducts(); }}
              disabled={loading}
              className={`transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${activeTab === "products" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Products
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={() => { setActiveTab("metafields"); fetchMetafields(); }}
              disabled={metafieldsLoading}
              className={`transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${activeTab === "metafields" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Metafields
            </button>
            {activeTab === "products" && selectedProduct && (
              <>
                <span className="text-gray-500">→</span>
                <span className="text-gray-300">{selectedProduct.product}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!selectedProduct && (
              <button
                onClick={() => { setCreating((v) => !v); setCreateError(null); setNewProductName(""); }}
                disabled={loading}
                aria-label="Create product"
                className="text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {selectedProduct && (
              <>
                {generateMetafieldsError && (
                  <span className="text-xs text-red-400">{generateMetafieldsError}</span>
                )}
                <button
                  onClick={generateProductData}
                  disabled={generatingMetafields || loading}
                  className="flex items-center gap-1.5 rounded-lg border border-teal-700 px-3 py-1.5 text-xs text-teal-400 hover:text-teal-300 hover:border-teal-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingMetafields ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Generate Product Data
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh"
              className="text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1">
          {/* Metafields tab */}
          {activeTab === "metafields" && (
            <div>
              {metafieldsLoading && <p className="text-sm text-gray-400">Loading metafields…</p>}
              {metafieldsError && <p className="text-sm text-red-400">{metafieldsError}</p>}
              {!metafieldsLoading && !metafieldsError && metafields.length === 0 && (
                <p className="text-sm text-gray-500">No metafields found.</p>
              )}
              {metafields.length > 0 && (() => {
                const items = metafields.flatMap((row) =>
                  Object.values(row).flatMap((val) =>
                    String(val ?? "").split(",").map((s) => s.trim()).filter(Boolean)
                  )
                );
                return (
                  <div className="flex flex-col gap-2">
                    {items.map((name) => (
                      <div key={name} className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
                        <p className="text-sm text-gray-200 font-mono break-all">{name}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Products tab */}
          {activeTab === "products" && <>

          {/* Create form */}
          {creating && (
            <form onSubmit={createProduct} className="mb-4 flex gap-2 items-start">
              <div className="flex-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="Product name"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
                {createError && <p className="mt-1 text-xs text-red-400">{createError}</p>}
              </div>
              <button
                type="submit"
                disabled={createLoading || !newProductName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createLoading ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setCreateError(null); setNewProductName(""); }}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </form>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Product list */}
          {!selectedProduct && products.length > 0 && (
            <ul className="space-y-3">
              {products.map((p) => (
                <li key={p.row_number} className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                  <button
                    onClick={() => fetchProduct(p)}
                    className="font-semibold text-gray-100 hover:text-blue-400 transition-colors text-left"
                  >
                    <span className="text-gray-500 font-normal mr-2">#{p.row_number}</span>
                    {p.product}
                  </button>
                  <div className="mt-1 flex gap-4 text-sm">
                    <a href={p["Drive Folder link"]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Drive Folder</a>
                    <a href={p["Drive Sheets link"]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Drive Sheet</a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!selectedProduct && !loading && products.length === 0 && !error && (
            <p className="text-sm text-gray-500">Click "Products" to load.</p>
          )}

          {deleteError && <p className="mb-2 text-xs text-red-400">{deleteError}</p>}

          {/* URL info modal */}
          {viewInfoEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewInfoEntry(null)}>
              <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">URL Info</h2>
                  <button onClick={() => setViewInfoEntry(null)} className="text-gray-500 hover:text-white transition-colors ml-4 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <a href={viewInfoEntry.URL} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline break-all block mb-4">{viewInfoEntry.URL}</a>
                {viewInfoEntry.title && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</p>
                    <p className="text-sm text-white">{viewInfoEntry.title}</p>
                  </div>
                )}
                {viewInfoEntry.content && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Content</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{viewInfoEntry.content}</p>
                  </div>
                )}
                {viewInfoEntry.images && viewInfoEntry.images.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Images</p>
                    <div className="grid grid-cols-3 gap-2">
                      {viewInfoEntry.images.map((src, i) => (
                        <button key={i} type="button" onClick={() => setLightboxIndex(i)} className="rounded-lg overflow-hidden border border-gray-700 hover:opacity-80 transition-opacity focus:outline-none">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Image ${i + 1}`} className="w-full h-24 object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {viewInfoEntry.html && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">HTML</p>
                    <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{viewInfoEntry.html}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Extractor Prompt modal */}
          {viewPromptModal && (() => {
            const entry = prompts.find((p) => "Data Extractor" in p) ?? prompts[0];

            async function savePrompt() {
              if (!entry) return;
              setSavingPrompt(true);
              setSavePromptError(null);
              try {
                const payload = { row_number: entry.row_number, prompt_name: "Data Extractor", "Data Extractor": editingPrompt };
                console.log("[prompt] PUT request", payload);
                const res = await fetch("/api/prompt", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                console.log("[prompt] PUT response", data);
                if (!res.ok) throw new Error(data?.error ?? "Failed to save");
                const updated: Prompt[] = Array.isArray(data) ? data : [data];
                setPrompts(updated);
                const updatedEntry = updated.find((p) => "Data Extractor" in p) ?? updated[0];
                const updatedText = updatedEntry ? (updatedEntry["Data Extractor"] as string) ?? "" : editingPrompt;
                setEditingPrompt(updatedText);
                setOriginalPrompt(updatedText);
              } catch (err) {
                setSavePromptError(err instanceof Error ? err.message : "Unknown error");
              } finally {
                setSavingPrompt(false);
              }
            }

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-[95vw] max-w-7xl h-[90vh] flex flex-col rounded-xl border border-purple-800 bg-gray-900 p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white">Data Extractor Prompt</h2>
                    <button onClick={() => setViewPromptModal(false)} className="text-gray-500 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {promptsLoading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                  ) : entry ? (
                    <>
                      <textarea
                        value={editingPrompt}
                        onChange={(e) => setEditingPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            if (editingPrompt !== originalPrompt && !savingPrompt) savePrompt();
                          }
                        }}
                        className="flex-1 w-full rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 p-4 font-mono resize-none focus:outline-none focus:border-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        spellCheck={false}
                        disabled={savingPrompt}
                      />
                      {savePromptError && <p className="mt-2 text-xs text-red-400">{savePromptError}</p>}
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={savePrompt}
                          disabled={savingPrompt || editingPrompt === originalPrompt}
                          className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingPrompt ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Prompt not found.</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Image lightbox */}
          {viewInfoEntry?.images && viewInfoEntry.images.length > 0 && (
            <Lightbox
              open={lightboxIndex >= 0}
              index={lightboxIndex}
              close={() => setLightboxIndex(-1)}
              slides={viewInfoEntry.images.map((src) => ({ src }))}
            />
          )}

          {/* Metafield image picker modal */}
          {metafieldImageModal && productDetail && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setMetafieldImageModal(false)}>
              <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-3xl w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-200">Select Image</p>
                  <button onClick={() => setMetafieldImageModal(false)} className="text-gray-500 hover:text-gray-200 text-xl leading-none">&times;</button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {productDetail.urls.flatMap((u) => u.images ?? []).map((imgUrl, i) => (
                    <button
                      key={i}
                      onClick={() => { setEditMetafieldValue(imgUrl); setMetafieldImageModal(false); }}
                      className={`relative aspect-square rounded overflow-hidden border-2 ${
                        editMetafieldValue === imgUrl ? "border-indigo-500" : "border-transparent"
                      } hover:border-indigo-400`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {productDetail.urls.flatMap((u) => u.images ?? []).length === 0 && (
                    <p className="col-span-4 text-gray-500 text-sm">No images found in links. Fetch link data first.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar image lightbox */}
          {sidebarLightbox && (
            <Lightbox
              open
              index={sidebarLightbox.index}
              close={() => setSidebarLightbox(null)}
              slides={(sidebarLightbox.entry.images ?? []).map((src) => ({ src }))}
            />
          )}

          {/* Product images lightbox */}
          {productDetail?.images && productDetail.images.flatMap((g) => g.items).length > 0 && (
            <Lightbox
              open={productLightboxIndex >= 0}
              index={productLightboxIndex}
              close={() => setProductLightboxIndex(-1)}
              slides={productDetail.images.flatMap((g) => g.items).map((img) => ({ src: img.url }))}
            />
          )}

          {/* Confirmation modal */}
          {confirmEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
                <h2 className="text-base font-semibold text-white mb-2">Remove link?</h2>
                <p className="text-sm text-gray-400 mb-1">This will permanently remove the following link:</p>
                <p className="text-sm text-blue-400 break-all mb-6">{confirmEntry.URL}</p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmEntry(null)}
                    className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteProductLink(confirmEntry)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Product detail */}
          {selectedProduct && productDetail && (
            <div className="flex gap-4 items-start">
              {/* Left: product images */}
              {productDetail.images && productDetail.images.flatMap((g) => g.items).length > 0 && (() => {
                const allImages = productDetail.images!.flatMap((g) => g.items).filter((img) => !!img.url);
                return (
                  <div className="w-75 shrink-0 rounded-lg border border-gray-700 bg-gray-800 px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <span>Images</span>
                        {selectedImages.size > 0 && <span className="block text-blue-400">({selectedImages.size} selected)</span>}
                      </p>
                      <div className="flex items-center gap-2">
                        {updateImagesError && <span className="text-xs text-red-400">{updateImagesError}</span>}
                        {selectedImages.size > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedImages(new Set())}
                              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={updateImages}
                              disabled={updatingImages}
                              className="flex items-center gap-1.5 rounded-lg border border-red-800 px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingImages ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Updating…
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete selected
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {allImages.map((img, i) => {
                        const isSelected = selectedImages.has(img.row_number);
                        return (
                          <button
                            key={img.row_number}
                            type="button"
                            onClick={() => setProductLightboxIndex(i)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setSelectedImages((prev) => {
                                const next = new Set(prev);
                                if (next.has(img.row_number)) next.delete(img.row_number);
                                else next.add(img.row_number);
                                return next;
                              });
                            }}
                            className={`relative aspect-square rounded-lg overflow-hidden border transition-all focus:outline-none ${
                              isSelected
                                ? "border-blue-400 ring-2 ring-blue-400 opacity-90"
                                : "border-gray-700 hover:opacity-80"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-300 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Center: metadata */}
              <div className="flex-1 min-w-0 space-y-2">
              {/* Links field */}
              <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 flex gap-4 items-center">
                <span className="text-gray-400 text-sm w-32 shrink-0">Navigation</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "Drive Folder", val: selectedProduct!["Drive Folder link"] },
                    { label: "Drive Sheet", val: selectedProduct!["Drive Sheets link"] },
                    { label: "Document", val: productDetail.document_url },
                  ].filter((l) => !!l.val).map(({ label, val }) => (
                    <a key={label} href={val} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
              {/* Row + Title + Metafields combined */}
              <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 flex flex-col gap-2">
                <div className="flex gap-4 items-baseline">
                  <span className="text-gray-400 text-sm w-32 shrink-0">Row</span>
                  <span className="text-gray-100 text-sm">{productDetail.row_number}</span>
                </div>
                <div className="h-px bg-gray-700" />
                <div className="flex gap-4 items-baseline">
                  <span className="text-gray-400 text-sm w-32 shrink-0">Title</span>
                  <span className="text-gray-100 text-sm break-all">{productDetail.product_title}</span>
                </div>
                {productDetail.metafields && productDetail.metafields.flatMap((g) => g.items).filter((mf) => mf.Metafield).map((mf) => (
                  <div key={`${mf.row_number}-${mf.Metafield}`} className="flex flex-col gap-2 border-t border-gray-700 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-4 items-baseline min-w-0 flex-1">
                        <span className="text-gray-400 text-sm w-32 shrink-0 truncate" title={mf.Metafield}>{mf.Metafield}</span>
                        {editingMetafield !== mf.row_number && (
                          <span className="text-gray-100 text-sm break-all">{mf.value ?? ""}</span>
                        )}
                      </div>
                      {editingMetafield !== mf.row_number ? (
                        <button
                          onClick={() => { setEditingMetafield(mf.row_number); setEditMetafieldValue(mf.value ?? ""); setSaveMetafieldError(null); }}
                          className="text-xs text-gray-500 hover:text-indigo-400 shrink-0"
                        >Edit</button>
                      ) : (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => updateMetafield(mf.row_number, mf.Metafield, editMetafieldValue)}
                            disabled={savingMetafield}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50"
                          >{savingMetafield ? "Saving…" : "Save"}</button>
                          <button
                            onClick={() => { setEditingMetafield(null); setSaveMetafieldError(null); }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >Cancel</button>
                        </div>
                      )}
                    </div>
                    {editingMetafield === mf.row_number && (
                      <div className="flex flex-col gap-1">
                        {mf.Type === "single_line_text_field" && (
                          <input
                            type="text"
                            value={editMetafieldValue}
                            onChange={(e) => setEditMetafieldValue(e.target.value)}
                            autoFocus
                            className="w-full rounded bg-gray-900 border border-gray-600 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                          />
                        )}
                        {mf.Type === "rich_text_field" && (
                          <textarea
                            rows={3}
                            value={editMetafieldValue}
                            onChange={(e) => setEditMetafieldValue(e.target.value)}
                            autoFocus
                            className="w-full rounded bg-gray-900 border border-gray-600 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-y"
                          />
                        )}
                        {mf.Type === "file_reference" && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setMetafieldImageModal(true)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded"
                            >Select image…</button>
                            {editMetafieldValue && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={editMetafieldValue} alt="" className="h-10 w-10 object-cover rounded border border-gray-600" />
                            )}
                          </div>
                        )}
                        {saveMetafieldError && (
                          <p className="text-red-400 text-xs">{saveMetafieldError}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {([
                ["Shopify GID", productDetail.shopify_gid],
              ] as [string, string][]).map(([label, val]) => val ? (
                <div key={label} className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 flex flex-col gap-1">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <span className="text-gray-100 text-sm break-all">{val}</span>
                </div>
              ) : null)}
              </div>

              {/* Right: links */}
              <div className="w-75 shrink-0">
              {/* URLs */}
              {productDetail && (
                <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Links</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {productDetail.urls.some((u) => u.images && u.images.length > 0) && (
                        <button
                          onClick={() => setShowImagesSidebar((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs transition-colors ${
                            showImagesSidebar
                              ? "border-amber-600 text-amber-400 bg-amber-400/10"
                              : "border-gray-600 text-gray-300 hover:text-white hover:border-gray-400"
                          }`}
                          aria-label="Toggle images sidebar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Images
                        </button>
                      )}
                      <button
                          onClick={() => {
                            const entry = prompts.find((p) => "Data Extractor" in p) ?? prompts[0];
                            console.log("[prompt] opening modal, entry =", entry);
                            const promptText = entry ? (entry["Data Extractor"] as string) ?? "" : "";
                            setEditingPrompt(promptText);
                            setOriginalPrompt(promptText);
                            setSavePromptError(null);
                            setViewPromptModal(true);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-purple-800 px-3 py-1 text-xs text-purple-400 hover:text-purple-300 hover:border-purple-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Data Extractor Prompt
                        </button>
                      <button
                        onClick={() => { setSettingLinks((v) => !v); setSetLinksError(null); setProductLinks([""]); setSetLinksSuccess(false); setLinkErrors([null]); }}
                        disabled={loading}
                        aria-label="Add product links"
                        className="flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:text-white hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Add Links
                      </button>
                    </div>
                  </div>
                  {setLinksSuccess && (
                    <p className="mb-3 text-xs text-green-400">Links saved successfully.</p>
                  )}
                  {settingLinks && (
                    <form onSubmit={setProductLinksHandler} className="mb-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
                      <div className="space-y-2 mb-3">
                        {productLinks.map((link, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder="https://..."
                                value={link}
                                onChange={(e) => {
                                  setProductLinks((prev) => prev.map((l, j) => j === i ? e.target.value : l));
                                  setLinkErrors((prev) => prev.map((err, j) => j === i ? null : err));
                                }}
                                className={`flex-1 rounded-lg border bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none ${
                                  linkErrors[i] ? "border-red-500 focus:border-red-500" : "border-gray-600 focus:border-blue-500"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setProductLinks((prev) => prev.filter((_, j) => j !== i));
                                  setLinkErrors((prev) => prev.filter((_, j) => j !== i));
                                }}
                                disabled={productLinks.length === 1}
                                className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Remove link"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            {linkErrors[i] && <p className="text-xs text-red-400 pl-1">{linkErrors[i]}</p>}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProductLinks((prev) => [...prev, ""]);
                          setLinkErrors((prev) => [...prev, null]);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add link
                      </button>
                      {setLinksError && <p className="mb-2 text-xs text-red-400">{setLinksError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={setLinksLoading}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {setLinksLoading ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSettingLinks(false); setSetLinksError(null); setLinkErrors([null]); }}
                          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                  {productDetail.urls.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {productDetail.urls.map((entry) => (
                      <div key={`${entry.URL}-${entry.row_number}`} className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
                        {/* Card header */}
                        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-1.5">
                          <span className="text-xs text-gray-500 font-medium">Link #{entry.row_number}</span>
                          <div className="flex items-center gap-1">
                            {/* Info button */}
                            {(entry.title || entry.content || entry.html || entry.images) && (
                              <button
                                type="button"
                                onClick={() => setViewInfoEntry(entry)}
                                aria-label="View URL info"
                                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Info
                              </button>
                            )}
                            {/* Fetch data button */}
                            <button
                              type="button"
                              onClick={() => fetchProductData(entry)}
                              disabled={fetchingData.has(entry.URL) || !!(entry.title && entry.content) || fetchedUrls.has(entry.URL)}
                              aria-label="Fetch product data"
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                                (entry.title && entry.content) || fetchedUrls.has(entry.URL)
                                  ? "text-green-400 bg-green-400/10"
                                  : "text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                              }`}
                            >
                              {fetchingData.has(entry.URL) ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Fetching…
                                </>
                              ) : (entry.title && entry.content) || fetchedUrls.has(entry.URL) ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Done
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Fetch
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmEntry(entry)}
                              disabled={deletingLink === entry.URL}
                              aria-label="Delete link"
                              className="rounded-md p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              {deletingLink === entry.URL ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        {/* Card body */}
                        <div className="px-4 py-2.5 min-w-0">
                          <a href={entry.URL} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate block" title={entry.URL}>{entry.URL}</a>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
              </div>{/* end links column */}
            </div>
          )}
          </>}
        </div>
      </div>

      {/* Images sidebar */}
      {showImagesSidebar && productDetail && (
        <div className="w-80 shrink-0 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3 shrink-0">
              <p className="text-sm font-semibold text-white">
                <span>Images from links</span>
                {sidebarSelectedImages.size > 0 && <span className="block text-amber-400 font-normal text-xs">({sidebarSelectedImages.size} selected)</span>}
              </p>
              <div className="flex items-center gap-2">
                {addImagesError && <span className="text-xs text-red-400 max-w-35 truncate" title={addImagesError}>{addImagesError}</span>}
                {sidebarSelectedImages.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSidebarSelectedImages(new Set())}
                      className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={addImagesFromSidebar}
                      disabled={addingImages}
                      className="flex items-center gap-1 rounded-lg border border-amber-700 px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 hover:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingImages ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {addingImages ? "Adding…" : "Add to product"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowImagesSidebar(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="Close sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
              {(() => {
                const productImageUrls = new Set(
                  (productDetail.images ?? []).flatMap((g) => g.items).map((img) => img.url)
                );
                return productDetail.urls.filter((e) => e.images && e.images.length > 0).map((entry) => (
                <div key={entry.row_number}>
                  <a
                    href={entry.URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-400 hover:underline break-all mb-2"
                  >
                    {entry.URL}
                  </a>
                  <div className="grid grid-cols-3 gap-1.5">
                    {entry.images!.map((src, i) => {
                      const isSelected = sidebarSelectedImages.has(src);
                      const alreadyAdded = productImageUrls.has(src);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSidebarLightbox({ entry, index: i })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (alreadyAdded) return;
                            setSidebarSelectedImages((prev) => {
                              const next = new Set(prev);
                              if (next.has(src)) next.delete(src);
                              else next.add(src);
                              return next;
                            });
                          }}
                          className={`relative rounded-md overflow-hidden border transition-all focus:outline-none aspect-square ${
                            alreadyAdded
                              ? "border-gray-600 opacity-40 cursor-default"
                              : isSelected
                              ? "border-amber-400 ring-2 ring-amber-400"
                              : "border-gray-700 hover:opacity-80"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                          {alreadyAdded && (
                            <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {isSelected && !alreadyAdded && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-300 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
              })()}
              {productDetail.urls.every((e) => !e.images || e.images.length === 0) && (
                <p className="text-sm text-gray-500">No images found in links.</p>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
