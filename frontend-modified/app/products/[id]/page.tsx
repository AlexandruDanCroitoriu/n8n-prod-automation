"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";

type Product = {
  id: number;
  created_at: string;
  title: string;
  description: string;
  status: string;
  template_suffix: string;
  price: number;
  compare_at_price: number;
  shopify_gid: string | null;
  active: boolean;
  images: string[] | null;
};

type ProductLink = Record<string, unknown>;

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [links, setLinks] = useState<ProductLink[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [linkInputs, setLinkInputs] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [fetchingLinkIds, setFetchingLinkIds] = useState<Set<number>>(new Set());
  const [infoLink, setInfoLink] = useState<ProductLink | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [imagesSidebarOpen, setImagesSidebarOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [deletingImages, setDeletingImages] = useState(false);
  const [selectedSidebarImages, setSelectedSidebarImages] = useState<Set<string>>(new Set());
  const [addingImages, setAddingImages] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [postingToShopify, setPostingToShopify] = useState(false);
  const [metafields, setMetafields] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.images.length });
      if (e.key === "ArrowLeft") setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length });
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!descModalOpen && !infoLink) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDescModalOpen(false);
        setInfoLink(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [descModalOpen, infoLink]);

  async function fetchAll() {
    try {
      const [productRes, linksRes, metafieldsRes] = await Promise.all([
        fetch(`/api/products/${id}`),
        fetch(`/api/products/${id}/links`),
        fetch(`/api/products/${id}/metafields`),
      ]);

      const productData = await productRes.json();
      if (!productRes.ok) throw new Error(productData?.error ?? `Failed to load product (${productRes.status})`);
      const item: Product = Array.isArray(productData) ? productData[0] : (productData?.data ? (Array.isArray(productData.data) ? productData.data[0] : productData.data) : productData);
      if (!item) throw new Error("Product not found");
      setProduct(item);

      const linksData = await linksRes.json();
      if (linksRes.ok) {
        const arr: ProductLink[] = Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []);
        setLinks(arr);
      }

      if (metafieldsRes.ok) {
        const mfData = await metafieldsRes.json();
        const arr = Array.isArray(mfData) ? mfData : (Array.isArray(mfData?.data) ? mfData.data : []);
        setMetafields(arr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [id]);

  async function handleFetchLink(linkId: number) {
    setFetchingLinkIds((prev) => new Set(prev).add(linkId));
    try {
      await fetch(`/api/products/${id}/links/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      });
      const linksRes = await fetch(`/api/products/${id}/links`);
      const linksData = await linksRes.json();
      if (linksRes.ok) {
        setLinks(Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []));
      }
    } finally {
      setFetchingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
    }
  }

  async function handleDeleteLink(linkId: number) {
    setDeletingLinkId(linkId);
    try {
      await fetch(`/api/products/${id}/links/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      });
      const linksRes = await fetch(`/api/products/${id}/links`);
      const linksData = await linksRes.json();
      if (linksRes.ok) {
        setLinks(Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []));
      }
    } finally {
      setDeletingLinkId(null);
    }
  }

  async function handleAddImages() {
    setAddingImages(true);
    try {
      await fetch(`/api/products/${id}/images/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: Array.from(selectedSidebarImages) }),
      });
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      if (res.ok) {
        const item = Array.isArray(data) ? data[0] : (data?.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data);
        setProduct(item);
      }
      setSelectedSidebarImages(new Set());
    } finally {
      setAddingImages(false);
    }
  }

  async function handleDeleteImages() {
    setDeletingImages(true);
    try {
      await fetch(`/api/products/${id}/images/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: Array.from(selectedImages) }),
      });
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      if (res.ok) {
        const item = Array.isArray(data) ? data[0] : (data?.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data);
        setProduct(item);
      }
      setSelectedImages(new Set());
    } finally {
      setDeletingImages(false);
    }
  }

  async function handleAddLinks(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const validLinks = linkInputs.map((l) => l.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/products/${id}/links/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: validLinks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      // refresh links
      const linksRes = await fetch(`/api/products/${id}/links`);
      const linksData = await linksRes.json();
      if (linksRes.ok) {
        setLinks(Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []));
      }
      setModalOpen(false);
      setLinkInputs([""]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-800 to-gray-900 flex items-start justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-gray-700 px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white">{product?.title ?? `Product #${id}`}</h1>
        </div>
        <div className="px-6 py-6 flex-1 flex gap-6 items-start">
          {product && (
            <div className="shrink-0 flex flex-col gap-2" style={{ width: 250 }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Images</h2>
                {selectedImages.size > 0 && (
                  <button
                    onClick={handleDeleteImages}
                    disabled={deletingImages}
                    className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:border-red-500 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    {deletingImages ? "Removing…" : `Remove (${selectedImages.size})`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
              {Array.isArray(product.images) && product.images.length > 0 ? product.images.map((src, i) => {
                const selected = selectedImages.has(src);
                return (
                  <div key={i} className="relative">
                    <button
                      onClick={() => setLightbox({ images: product.images as string[], index: i })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedImages((prev) => {
                          const next = new Set(prev);
                          next.has(src) ? next.delete(src) : next.add(src);
                          return next;
                        });
                      }}
                      className="focus:outline-none w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`product-img-${i}`}
                        className={`w-full rounded-lg border object-cover transition-colors ${
                          selected ? "border-red-500 opacity-60" : "border-gray-700 hover:border-gray-400"
                        }`}
                      />
                    </button>
                    {selected && (
                      <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-500 col-span-2">No images.</p>
              )}
              </div>
            </div>
          )}
          <div style={{ width: 800 }}>
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {product && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 divide-y divide-gray-700">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-700">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Details</span>
                {!product.shopify_gid && (
                  <button
                    onClick={async () => {
                      setPostingToShopify(true);
                      try {
                        await fetch(`/api/products/${id}/post-to-shopify`, { method: "POST" });
                        await fetchAll();
                      } finally {
                        setPostingToShopify(false);
                      }
                    }}
                    disabled={postingToShopify}
                    className="text-xs px-2 py-0.5 rounded-full border border-gray-600 text-gray-500 hover:border-orange-600 hover:text-orange-400 disabled:opacity-40 transition-colors"
                  >
                    {postingToShopify ? "Posting…" : "No GID"}
                  </button>
                )}
                <span className="mr-auto" />
                <button
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      await fetch(`/api/products/${id}/generate`, { method: "POST" });
                      await fetchAll();
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="text-xs px-2 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {generating ? "Generating…" : "Generate"}
                </button>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${product.active ? "border-green-700 text-green-400" : "border-gray-600 text-gray-400"}`}>
                  {product.active ? "Active" : "Inactive"}
                </span>
                {product.shopify_gid && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-blue-700 text-blue-400 max-w-[180px] truncate" title={product.shopify_gid}>{product.shopify_gid}</span>
                )}
              </div>
              <div className="px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-300">{product.title}</h2>
              </div>
              <div className="px-4 py-3 flex items-start gap-2">
                <div className="text-gray-300 text-sm flex-1 line-clamp-3 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description ?? "" }} />
                {product.description && (
                  <button
                    onClick={() => setDescModalOpen(true)}
                    className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-0.5"
                    title="View full description"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
          {metafields && metafields.length > 0 && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 divide-y divide-gray-700 mt-4">
              <div className="px-4 py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Metafields</span>
              </div>
              {metafields.map((mf, i) => {
                const key = (mf.key ?? mf.namespace ?? String(i)) as string;
                const value = mf.value ?? mf.value_type ?? "";
                return (
                  <div key={i} className="px-4 py-3 flex gap-4">
                    <span className="text-gray-400 text-sm w-48 shrink-0 truncate" title={key}>{key}</span>
                    <span className="text-gray-100 text-sm break-all">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          )}
          </div>
          {links !== null && (
            <div className="shrink-0" style={{ width: 250 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Product Links</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setImagesSidebarOpen(true)}
                    className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
                  >
                    Images
                  </button>
                  <button
                    onClick={() => { setModalOpen(true); setLinkInputs([""]); setSubmitError(null); }}
                    className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
              {links.length === 0 ? (
                <p className="text-sm text-gray-500">No links found.</p>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-800 divide-y divide-gray-700">
                  {links.map((link, i) => {
                    const url = Object.values(link).find(
                      (v) => typeof v === "string" && v.startsWith("http")
                    ) as string | undefined;
                    if (!url) return null;
                    const linkId = link.id as number;
                    const isFetched = !!(link.title && link.content && link.images &&
                      (Array.isArray(link.images) ? link.images.length > 0 : link.images));
                    return (
                      <div key={i} className="px-4 py-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isFetched && (
                              <button
                                onClick={() => setInfoLink(link)}
                                className="text-gray-600 hover:text-gray-300 transition-colors"
                                title="View details"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleFetchLink(linkId)}
                              disabled={fetchingLinkIds.has(linkId) || deletingLinkId === linkId}
                              className={`disabled:opacity-40 transition-colors ${fetchingLinkIds.has(linkId) ? "text-blue-400" : isFetched ? "text-blue-600 hover:text-blue-400" : "text-gray-600 hover:text-blue-400"}`}
                              title={isFetched ? "Re-fetch link details" : "Fetch link details"}
                            >
                              {fetchingLinkIds.has(linkId) ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteLink(linkId)}
                            disabled={deletingLinkId === linkId || fetchingLinkIds.has(linkId)}
                            className="text-gray-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                            title="Remove link"
                          >
                            {deletingLinkId === linkId ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 truncate"
                          title={url}
                        >
                          {url}
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {imagesSidebarOpen && (() => {
        type ImageGroup = { label: string; images: string[] };
        const groups: ImageGroup[] = (links ?? []).flatMap((link, li) => {
          const imgs: string[] = Array.isArray(link.images)
            ? (link.images as string[])
            : Object.values(link).filter(
                (v) => typeof v === "string" && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(v as string)
              ) as string[];
          if (imgs.length === 0) return [];
          const url = Object.values(link).find(
            (v) => typeof v === "string" && (v as string).startsWith("http") && !/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(v as string)
          ) as string | undefined;
          const label = (link.title ?? url ?? `Link ${li + 1}`) as string;
          return [{ label, images: imgs }];
        });
        const allImages = groups.flatMap((g) => g.images);
        let globalIndex = 0;
        return (
          <div className="shrink-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden sticky top-4" style={{ width: 640, maxHeight: "calc(100vh - 2rem)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">All Images</h2>
                <div className="flex items-center gap-2">
                  {selectedSidebarImages.size > 0 && (
                    <button
                      onClick={handleAddImages}
                      disabled={addingImages}
                      className="text-xs px-2 py-1 rounded border border-blue-700 text-blue-400 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50 transition-colors"
                    >
                      {addingImages ? "Adding…" : `Add (${selectedSidebarImages.size})`}
                    </button>
                  )}
                  <button onClick={() => { setImagesSidebarOpen(false); setSelectedSidebarImages(new Set()); }} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                {groups.length === 0 ? (
                  <p className="text-sm text-gray-500">No images found.</p>
                ) : (
                  groups.map((group) => {
                    const startIndex = globalIndex;
                    globalIndex += group.images.length;
                    return (
                      <div key={group.label}>
                        <p className="text-xs text-gray-500 truncate mb-2" title={group.label}>{group.label}</p>
                        <div className="grid grid-cols-4 gap-2">
                          {group.images.map((src, i) => {
                            const sel = selectedSidebarImages.has(src);
                            return (
                              <div key={i} className="relative">
                                <button
                                  onClick={() => setLightbox({ images: allImages, index: startIndex + i })}
                                  onContextMenu={(e) => { e.preventDefault(); setSelectedSidebarImages((prev) => { const next = new Set(prev); next.has(src) ? next.delete(src) : next.add(src); return next; }); }}
                                  className="focus:outline-none w-full"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={src} alt={`img-${i}`} className={`w-full h-24 rounded-lg border object-cover transition-colors ${sel ? "border-blue-500 opacity-70" : "border-gray-700 hover:border-gray-400"}`} />
                                </button>
                                {sel && (
                                  <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
        );
      })()}

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <div className="relative flex items-center justify-center max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl leading-none z-10">&times;</button>
            {lightbox.images.length > 1 && (
              <button
                onClick={() => setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length })}
                className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white px-2 py-4 text-2xl z-10"
              >&#8249;</button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.images[lightbox.index]} alt="lightbox" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
            {lightbox.images.length > 1 && (
              <button
                onClick={() => setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.images.length })}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white px-2 py-4 text-2xl z-10"
              >&#8250;</button>
            )}
            {lightbox.images.length > 1 && (
              <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500">{lightbox.index + 1} / {lightbox.images.length}</p>
            )}
          </div>
        </div>
      )}

      {descModalOpen && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDescModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Description</h2>
              <button onClick={() => setDescModalOpen(false)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none ml-3">&times;</button>
            </div>
            <div className="text-gray-300 text-sm prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description ?? "" }} />
          </div>
        </div>
      )}

      {infoLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setInfoLink(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white truncate">
                {(infoLink.title ?? infoLink.name ?? infoLink.label ?? "Link Details") as string}
              </h2>
              <button onClick={() => setInfoLink(null)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none ml-3 shrink-0">&times;</button>
            </div>
            <div className="flex flex-col gap-4">
              {(() => {
                const images: string[] = [];
                const fields: [string, unknown][] = [];
                for (const [key, val] of Object.entries(infoLink)) {
                  if (["id", "product_id", "created_at"].includes(key)) continue;
                  if (key === "images" && Array.isArray(val)) {
                    images.push(...(val as string[]));
                  } else if (typeof val === "string" && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(val)) {
                    images.push(val);
                  } else {
                    fields.push([key, val]);
                  }
                }
                return (
                  <>
                    {fields.map(([key, val]) => (
                      <div key={key}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{key}</p>
                        <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{String(val ?? "")}</p>
                      </div>
                    ))}
                    {images.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Images</p>
                        <div className="grid grid-cols-4 gap-2">
                          {images.map((src, i) => (
                            <button key={i} onClick={() => setLightbox({ images, index: i })} className="focus:outline-none">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`image-${i}`} className="w-full h-20 rounded-lg border border-gray-700 object-cover hover:border-gray-400 transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Add Product Links</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddLinks} className="flex flex-col gap-3">
              {linkInputs.map((val, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={val}
                    onChange={(e) => {
                      const updated = [...linkInputs];
                      updated[i] = e.target.value;
                      setLinkInputs(updated);
                    }}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                    required
                  />
                  {linkInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinkInputs(linkInputs.filter((_, j) => j !== i))}
                      className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none px-1"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLinkInputs([...linkInputs, ""])}
                className="text-xs text-gray-400 hover:text-white transition-colors self-start"
              >
                + Add another
              </button>
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors">
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
