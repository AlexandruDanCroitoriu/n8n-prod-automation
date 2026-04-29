"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ProductMetafield = {
  namespace: string;
  key: string;
  type: string;
  value: string;
};

type ProductImage = {
  original_image_url: string;
  image_url?: string | null;
  shopify_gid?: string | null;
};

type ProductImageLike =
  | string
  | {
      original_image_url?: string | null;
      image_url?: string | null;
      src?: string | null;
      url?: string | null;
      shopify_gid?: string | null;
      gid?: string | null;
    };

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
  images: ProductImageLike[] | null;
  metafields?: ProductMetafield[] | string | null;
  [key: string]: unknown;
};

type ProductLink = Record<string, unknown>;
type LinkImageGroup = { label: string; linkId: number | null; images: string[] };

const METAFIELD_DEFINITIONS = [
  { namespace: "custom", key: "tabel_specificatii_tehnice_multiline", type: "multi_line_text_field", label: "Tabel specificatii tehnice", multiline: true },
  { namespace: "custom", key: "showoff_1_richtext", type: "rich_text_field", label: "Showoff 1", multiline: true },
  { namespace: "custom", key: "showoff_2_richtext", type: "rich_text_field", label: "Showoff 2", multiline: true },
  { namespace: "custom", key: "showoff_3_richtext", type: "rich_text_field", label: "Showoff 3", multiline: true },
  { namespace: "custom", key: "section_1_title", type: "single_line_text_field", label: "Section 1 Title", multiline: false },
  { namespace: "custom", key: "section_2_title", type: "single_line_text_field", label: "Section 2 Title", multiline: false },
  { namespace: "custom", key: "section_1_image", type: "file_reference", label: "Section 1 Image", multiline: false },
  { namespace: "custom", key: "section_2_image", type: "file_reference", label: "Section 2 Image", multiline: false },
  { namespace: "custom", key: "section_1_description_rich", type: "rich_text_field", label: "Section 1 Description", multiline: true },
  { namespace: "custom", key: "section_2_description_rich", type: "rich_text_field", label: "Section 2 Description", multiline: true },
] as const;

type MetafieldKey = (typeof METAFIELD_DEFINITIONS)[number]["key"];

const THREE_COLUMN_METAFIELDS = new Set<MetafieldKey>([
  "showoff_1_richtext",
  "showoff_2_richtext",
  "showoff_3_richtext",
]);

const TWO_COLUMN_METAFIELDS = new Set<MetafieldKey>([
  "section_1_title",
  "section_2_title",
  "section_1_image",
  "section_2_image",
  "section_1_description_rich",
  "section_2_description_rich",
]);

type ProductForm = {
  title: string;
  description: string;
  status: string;
  template_suffix: string;
  price: string;
  compare_at_price: string;
  active: boolean;
};

function buildEmptyMetafields(): Record<MetafieldKey, string> {
  return Object.fromEntries(METAFIELD_DEFINITIONS.map((field) => [field.key, ""])) as Record<MetafieldKey, string>;
}

function escapeControlCharsInQuotedStrings(input: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString && char === "\n") {
      result += "\\n";
      continue;
    }

    if (inString && char === "\r") {
      result += "\\r";
      continue;
    }

    if (inString && char === "\t") {
      result += "\\t";
      continue;
    }

    result += char;
  }

  return result;
}

function extractJsonCandidate(value: string) {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^(?:```|~~~)[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*(?:```|~~~)$/);
  const unfenced = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (unfenced.startsWith("[") || unfenced.startsWith("{")) {
    return unfenced;
  }

  const objectIndex = unfenced.indexOf("{");
  const arrayIndex = unfenced.indexOf("[");
  const startIndex = [objectIndex, arrayIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];

  if (startIndex === undefined) {
    return unfenced;
  }

  const sliced = unfenced.slice(startIndex);
  const lastObjectIndex = sliced.lastIndexOf("}");
  const lastArrayIndex = sliced.lastIndexOf("]");
  const endIndex = Math.max(lastObjectIndex, lastArrayIndex);

  return endIndex >= 0 ? sliced.slice(0, endIndex + 1) : unfenced;
}

function parseMetafields(value: unknown): ProductMetafield[] {
  if (Array.isArray(value)) {
    return value as ProductMetafield[];
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  let current: unknown = value;
  for (let i = 0; i < 4; i += 1) {
    if (Array.isArray(current)) {
      return current as ProductMetafield[];
    }

    if (typeof current !== "string") {
      break;
    }

    const currentText = extractJsonCandidate(current);

    try {
      current = JSON.parse(currentText);
      continue;
    } catch {
      try {
        current = JSON.parse(escapeControlCharsInQuotedStrings(currentText));
        continue;
      } catch {
        break;
      }
    }
  }

  return Array.isArray(current) ? (current as ProductMetafield[]) : [];
}

function getPreferredTextValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  for (const value of values) {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

function getMetafieldValue(item: Product | null, key: MetafieldKey): string {
  if (!item) return "";

  const parsedMetafields = parseMetafields(item.metafields);
  const metafield = parsedMetafields.find((field) => field.namespace === "custom" && field.key === key);

  if (metafield) {
    return typeof metafield.value === "string" ? metafield.value : String(metafield.value ?? "");
  }

  const directValue = item[key] ?? item[`custom.${key}`];
  return getPreferredTextValue(directValue);
}

function getProductImageUrl(image: ProductImageLike): string {
  if (typeof image === "string") return image;
  return String(image.original_image_url ?? image.image_url ?? image.src ?? image.url ?? "");
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value) && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtmlTags(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMetafieldPreviewHtml(value: string, allowRawHtml = true) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<span class="text-gray-500">Click to edit</span>';
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  const containsTableMarkup = /<(table|thead|tbody|tr|td|th)\b/i.test(trimmed);

  if (!looksLikeHtml) {
    return escapeHtml(trimmed).replace(/\n/g, "<br />");
  }

  if (!allowRawHtml || containsTableMarkup) {
    const plainText = stripHtmlTags(trimmed) || "HTML content";
    return escapeHtml(plainText).replace(/\n/g, "<br />");
  }

  return trimmed;
}

function normalizeProductImages(images: ProductImageLike[] | null | undefined): ProductImage[] {
  return (Array.isArray(images) ? images : [])
    .map<ProductImage | null>((image) => {
      if (typeof image === "string") {
        return { original_image_url: image, image_url: image, shopify_gid: null };
      }

      const url = getProductImageUrl(image);
      if (!url) return null;

      return {
        original_image_url: url,
        image_url: url,
        shopify_gid: image.shopify_gid ?? image.gid ?? null,
      };
    })
    .filter((image): image is ProductImage => image !== null);
}

function getLinkImageGroups(sourceLinks: ProductLink[] | null): LinkImageGroup[] {
  return (sourceLinks ?? []).flatMap((link, li) => {
    const imgs: string[] = Array.isArray(link.images)
      ? (link.images as string[])
      : Object.values(link).filter(
          (v) => typeof v === "string" && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(v as string)
        ) as string[];

    if (imgs.length === 0) return [];

    const url = Object.values(link).find(
      (v) => typeof v === "string" && (v as string).startsWith("http") && !/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(v as string)
    ) as string | undefined;
    const rawLinkId = link.id;
    const linkId = typeof rawLinkId === "number" ? rawLinkId : Number(rawLinkId);

    return [{
      label: (link.title ?? url ?? `Link ${li + 1}`) as string,
      linkId: Number.isFinite(linkId) ? linkId : null,
      images: imgs,
    }];
  });
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
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
  const [deletingLinkImages, setDeletingLinkImages] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [postingToShopify, setPostingToShopify] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSaveError, setProductSaveError] = useState<string | null>(null);
  const [editingProductField, setEditingProductField] = useState<"title" | "description" | null>(null);
  const [metafieldImagePicker, setMetafieldImagePicker] = useState<MetafieldKey | null>(null);
  const [editingMetafield, setEditingMetafield] = useState<MetafieldKey | null>(null);
  const [metafieldImageUploading, setMetafieldImageUploading] = useState(false);
  const [metafieldImagePreview, setMetafieldImagePreview] = useState<Record<MetafieldKey, string>>(buildEmptyMetafields());
  const productFieldEditorRef = useRef<HTMLDivElement | null>(null);
  const metafieldEditorRef = useRef<HTMLDivElement | null>(null);
  const [metafieldForm, setMetafieldForm] = useState<Record<MetafieldKey, string>>(buildEmptyMetafields());
  const [productForm, setProductForm] = useState<ProductForm>({
    title: "",
    description: "",
    status: "",
    template_suffix: "",
    price: "0",
    compare_at_price: "0",
    active: false,
  });

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

  useEffect(() => {
    if (!editingProductField) return;

    function handlePointerDown(event: MouseEvent) {
      if (!productFieldEditorRef.current) return;
      if (!productFieldEditorRef.current.contains(event.target as Node)) {
        setEditingProductField(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [editingProductField]);

  useEffect(() => {
    if (!editingMetafield) return;

    function handlePointerDown(event: MouseEvent) {
      if (!metafieldEditorRef.current) return;
      if (!metafieldEditorRef.current.contains(event.target as Node)) {
        setEditingMetafield(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [editingMetafield]);

  async function fetchAll() {
    try {
      const [productRes, linksRes] = await Promise.all([
        fetch(`/api/products/${id}`),
        fetch(`/api/products/${id}/links`),
      ]);

      const productData = await productRes.json();
      if (!productRes.ok) throw new Error(productData?.error ?? `Failed to load product (${productRes.status})`);
      const item: Product = Array.isArray(productData) ? productData[0] : (productData?.data ? (Array.isArray(productData.data) ? productData.data[0] : productData.data) : productData);
      if (!item) throw new Error("Product not found");
      const normalizedItem: Product = {
        ...item,
        images: normalizeProductImages(Array.isArray(item.images) ? item.images : []),
      };
      setProduct(normalizedItem);
      setProductForm({
        title: normalizedItem.title ?? "",
        description: normalizedItem.description ?? "",
        status: normalizedItem.status ?? "",
        template_suffix: normalizedItem.template_suffix ?? "",
        price: String(normalizedItem.price ?? 0),
        compare_at_price: String(normalizedItem.compare_at_price ?? 0),
        active: Boolean(normalizedItem.active),
      });
      setMetafieldForm(
        METAFIELD_DEFINITIONS.reduce((acc, field) => {
          acc[field.key] = getMetafieldValue(normalizedItem, field.key);
          return acc;
        }, buildEmptyMetafields())
      );
      setMetafieldImagePreview(
        METAFIELD_DEFINITIONS.reduce((acc, field) => {
          const value = getMetafieldValue(normalizedItem, field.key);
          acc[field.key] = isImageUrl(value) ? value : "";
          return acc;
        }, buildEmptyMetafields())
      );

      const linksData = await linksRes.json();
      if (linksRes.ok) {
        const arr: ProductLink[] = Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []);
        setLinks(arr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  function toggleImageSelection(src: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  }

  function getSidebarImageKey(linkId: number | null, src: string) {
    return JSON.stringify({ linkId, src });
  }

  function parseSidebarImageKey(key: string): { linkId: number | null; src: string } | null {
    try {
      return JSON.parse(key) as { linkId: number | null; src: string };
    } catch {
      return null;
    }
  }

  function toggleSidebarImageSelection(linkId: number | null, src: string) {
    const key = getSidebarImageKey(linkId, src);
    setSelectedSidebarImages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleFetchLink(linkId: number) {
    setFetchingLinkIds((prev) => new Set(prev).add(linkId));
    try {
      const fetchRes = await fetch(`/api/products/${id}/links/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      });

      const fetchData = await fetchRes.json().catch(() => null);
      if (!fetchRes.ok) {
        throw new Error(fetchData?.error ?? `Failed to fetch link details (${fetchRes.status})`);
      }

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

  async function saveFullProductUpdate(
    overrides?: Partial<Product> & {
      images?: ProductImageLike[] | null;
      metafieldValues?: Partial<Record<MetafieldKey, string>>;
    }
  ) {
    if (!product) return;

    const effectiveMetafieldValues = {
      ...metafieldForm,
      ...(overrides?.metafieldValues ?? {}),
    };

    const metafields = METAFIELD_DEFINITIONS.map((field) => ({
      namespace: field.namespace,
      key: field.key,
      type: field.type,
      value: effectiveMetafieldValues[field.key] ?? "",
    }));

    const metafieldValues = Object.fromEntries(
      METAFIELD_DEFINITIONS.map((field) => [field.key, effectiveMetafieldValues[field.key] ?? ""])
    );

    const payload = {
      ...product,
      ...productForm,
      ...metafieldValues,
      ...overrides,
      id: Number(id),
      product_id: Number(id),
      price: Number(productForm.price || 0),
      compare_at_price: Number(productForm.compare_at_price || 0),
      active: productForm.active,
      images: normalizeProductImages(overrides?.images ?? (Array.isArray(product.images) ? product.images : [])),
      metafields: JSON.stringify(metafields),
      metafields_json: metafields,
    };

    const res = await fetch(`/api/products/${id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
  }

  async function handleAddImages() {
    if (!product) return;

    setAddingImages(true);
    try {
      const selectedToAdd = Array.from(new Set(
        Array.from(selectedSidebarImages)
          .map((key) => parseSidebarImageKey(key)?.src)
          .filter((src): src is string => Boolean(src))
      ));

      const currentImages = Array.isArray(product.images) ? product.images : [];
      const existingUrls = currentImages.map((img) => getProductImageUrl(img));
      const mergedUrls = Array.from(new Set([...existingUrls, ...selectedToAdd]));
      const images = mergedUrls.map((url) => {
        const existing = currentImages.find((img) => getProductImageUrl(img) === url);
        return existing ?? { original_image_url: url, shopify_gid: null };
      });

      await saveFullProductUpdate({ images });
      await fetchAll();
      setSelectedSidebarImages(new Set());
    } catch (err) {
      setProductSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingImages(false);
    }
  }

  async function handleDeleteLinkImages() {
    if (!links) return;

    const removedByLink = new Map<number, Set<string>>();
    for (const key of selectedSidebarImages) {
      const parsed = parseSidebarImageKey(key);
      if (!parsed || typeof parsed.linkId !== "number") continue;
      if (!removedByLink.has(parsed.linkId)) {
        removedByLink.set(parsed.linkId, new Set());
      }
      removedByLink.get(parsed.linkId)?.add(parsed.src);
    }

    const updates = links.flatMap((link) => {
      const linkId = Number(link.id);
      if (!Number.isFinite(linkId) || !removedByLink.has(linkId)) return [];

      const currentImages: string[] = Array.isArray(link.images)
        ? link.images.filter((img): img is string => typeof img === "string")
        : Object.values(link).filter(
            (v): v is string => typeof v === "string" && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(v)
          );

      const removed = removedByLink.get(linkId) ?? new Set<string>();
      const images = currentImages.filter((img) => !removed.has(img));

      return [{ link_id: linkId, images }];
    });

    if (updates.length === 0) {
      setSelectedSidebarImages(new Set());
      return;
    }

    setDeletingLinkImages(true);
    try {
      await fetch(`/api/products/${id}/links/images/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const linksRes = await fetch(`/api/products/${id}/links`);
      const linksData = await linksRes.json();
      if (linksRes.ok) {
        setLinks(Array.isArray(linksData) ? linksData : (Array.isArray(linksData?.data) ? linksData.data : []));
      }

      setSelectedSidebarImages(new Set());
    } finally {
      setDeletingLinkImages(false);
    }
  }

  async function handleDeleteImages() {
    if (!product) return;

    setDeletingImages(true);
    try {
      const currentImages = Array.isArray(product.images) ? product.images : [];
      const images = currentImages.filter((img) => !selectedImages.has(getProductImageUrl(img)));

      await saveFullProductUpdate({ images });
      await fetchAll();
      setSelectedImages(new Set());
    } catch (err) {
      setProductSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingImages(false);
    }
  }

  async function handleUpdateProduct() {
    if (!product) return;

    setSavingProduct(true);
    setProductSaveError(null);
    try {
      await saveFullProductUpdate();
      await fetchAll();
    } catch (err) {
      setProductSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleSelectMetafieldImage(src: string) {
    if (!metafieldImagePicker) return;

    setMetafieldImageUploading(true);
    setProductSaveError(null);
    try {
      const res = await fetch(`/api/products/${id}/images/upload-to-shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: {
            original_image_url: src,
            image_url: src,
            shopify_gid: null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }

      const shopifyImageGid = typeof data?.shopify_img_gid === "string"
        ? data.shopify_img_gid
        : typeof data?.shopify_gid === "string"
          ? data.shopify_gid
          : "";

      if (!shopifyImageGid) {
        throw new Error("No Shopify image GID was returned.");
      }

      const selectedField = metafieldImagePicker;
      const nextMetafieldValues = { ...metafieldForm, [selectedField]: shopifyImageGid };

      setMetafieldForm(nextMetafieldValues);
      setMetafieldImagePreview((prev) => ({ ...prev, [selectedField]: src }));
      await saveFullProductUpdate({ metafieldValues: nextMetafieldValues });
      await fetchAll();
      setMetafieldImagePicker(null);
    } catch (err) {
      setProductSaveError(err instanceof Error ? err.message : "Failed to upload image to Shopify");
    } finally {
      setMetafieldImageUploading(false);
    }
  }

  async function handlePostToShopify() {
    if (!product) return;

    if (!hasAllRequiredMetafields) {
      const missingLabels = missingRequiredMetafields.map((field) => field.label).join(", ");
      setProductSaveError(`Fill all metafields before posting to Shopify. Missing: ${missingLabels}`);
      return;
    }

    setPostingToShopify(true);
    setProductSaveError(null);

    try {
      await saveFullProductUpdate({
        images: normalizeProductImages(Array.isArray(product.images) ? product.images : []),
      });

      const res = await fetch(`/api/products/${id}/post-to-shopify`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `Failed (${res.status})`
        );
      }

      await fetchAll();
    } catch (err) {
      setProductSaveError(err instanceof Error ? err.message : "Failed to upload images and post product to Shopify");
    } finally {
      setPostingToShopify(false);
    }
  }

  const hasProductChanges = product
    ? productForm.title !== (product.title ?? "") ||
      productForm.description !== (product.description ?? "") ||
      productForm.status !== (product.status ?? "") ||
      productForm.template_suffix !== (product.template_suffix ?? "") ||
      Number(productForm.price || 0) !== Number(product.price ?? 0) ||
      Number(productForm.compare_at_price || 0) !== Number(product.compare_at_price ?? 0) ||
      productForm.active !== Boolean(product.active) ||
      METAFIELD_DEFINITIONS.some((field) => metafieldForm[field.key] !== getMetafieldValue(product, field.key))
    : false;
  const missingRequiredMetafields = METAFIELD_DEFINITIONS.filter(
    (field) => !String(metafieldForm[field.key] ?? "").trim()
  );
  const hasAllRequiredMetafields = missingRequiredMetafields.length === 0;
  const linkImageGroups = getLinkImageGroups(links);
  const activeMetafieldDefinition = metafieldImagePicker
    ? METAFIELD_DEFINITIONS.find((field) => field.key === metafieldImagePicker) ?? null
    : null;

  async function handleAddLinks(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const validLinks = linkInputs.map((l) => l.trim()).filter(Boolean);

    setModalOpen(false);
    setLinkInputs([""]);

    try {
      const res = await fetch(`/api/products/${id}/links/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: validLinks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);

      const linksRes = await fetch(`/api/products/${id}/links`);
      const linksData = await linksRes.json();
      const fetchedLinks: ProductLink[] = Array.isArray(linksData)
        ? linksData
        : (Array.isArray(linksData?.data) ? linksData.data : []);

      if (linksRes.ok) {
        setLinks(fetchedLinks);
      }

      const newLinkIds = Array.from(new Set(
        fetchedLinks.flatMap((link) => {
          const url = Object.values(link).find(
            (value) => typeof value === "string" && value.startsWith("http")
          ) as string | undefined;
          const linkId = Number(link.id);

          return url && validLinks.includes(url) && Number.isFinite(linkId) ? [linkId] : [];
        })
      ));

      await Promise.all(newLinkIds.map((linkId) => handleFetchLink(linkId)));

      const refreshedLinksRes = await fetch(`/api/products/${id}/links`);
      const refreshedLinksData = await refreshedLinksRes.json();
      if (refreshedLinksRes.ok) {
        setLinks(Array.isArray(refreshedLinksData) ? refreshedLinksData : (Array.isArray(refreshedLinksData?.data) ? refreshedLinksData.data : []));
      }

    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
      setModalOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-800 to-gray-900 flex items-start justify-center p-4">
      <div className="w-full max-w-screen-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-gray-700 px-6 py-4 flex items-center gap-3 min-w-0">
          <Link href="/" className="shrink-0 text-gray-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="flex-1 min-w-0 truncate text-xl font-bold text-white" title={productForm.title || product?.title || `Product #${id}`}>
            {productForm.title || product?.title || `Product #${id}`}
          </h1>
          {product && !product.shopify_gid && (
            <button
              onClick={handlePostToShopify}
              disabled={postingToShopify || !hasAllRequiredMetafields}
              title={hasAllRequiredMetafields ? "Upload images and post to Shopify" : "Fill all metafields first"}
              className="shrink-0 text-xs px-2 py-0.5 rounded-full border border-gray-600 text-gray-500 hover:border-orange-600 hover:text-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {postingToShopify ? "Uploading & Posting…" : "No GID"}
            </button>
          )}
          {product && (
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
              disabled={generating || savingProduct}
              className="shrink-0 text-xs px-2 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          )}
          {product?.shopify_gid && (
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full border border-blue-700 text-blue-400 max-w-45 truncate" title={product.shopify_gid}>
              {product.shopify_gid}
            </span>
          )}
        </div>
        <div className="px-6 py-6 flex-1 flex gap-6 items-start w-full min-w-0">
          {product && (
            <div className="shrink-0 flex flex-col gap-2" style={{ width: 250 }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Images</h2>
                {selectedImages.size > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-300">{selectedImages.size} selected</span>
                    <button
                      onClick={() => setSelectedImages(new Set())}
                      className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleDeleteImages}
                      disabled={deletingImages}
                      className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:border-red-500 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      {deletingImages ? "Removing…" : `Remove (${selectedImages.size})`}
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500">Select image(s) to remove</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
              {Array.isArray(product.images) && product.images.length > 0 ? product.images.map((image, i) => {
                const src = getProductImageUrl(image);
                const selected = selectedImages.has(src);
                return (
                  <div key={i} className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleImageSelection(src);
                      }}
                      className={`absolute top-1 right-1 z-10 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        selected
                          ? "border-red-500 bg-red-500/20 text-red-200"
                          : "border-gray-600 bg-gray-900/80 text-gray-300 hover:border-gray-400 hover:text-white"
                      }`}
                      title={selected ? "Deselect image" : "Select image to remove"}
                    >
                      {selected ? "Selected" : "Select"}
                    </button>
                    <button
                      onClick={() => setLightbox({ images: (product.images ?? []).map((img) => getProductImageUrl(img)), index: i })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleImageSelection(src);
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
                    {typeof image !== "string" && image.shopify_gid && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-green-300">
                        Shopify
                      </span>
                    )}
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-500 col-span-2">No images.</p>
              )}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {product && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 divide-y divide-gray-700">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-700">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Details</span>
                <span className="mr-auto" />
                {hasProductChanges && (
                  <button
                    onClick={handleUpdateProduct}
                    disabled={savingProduct}
                    className="text-xs px-2 py-0.5 rounded border border-blue-700 text-blue-400 hover:border-blue-500 hover:text-blue-300 disabled:opacity-40 transition-colors"
                  >
                    {savingProduct ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3 flex flex-col gap-4">
                {productSaveError && <p className="text-sm text-red-400">{productSaveError}</p>}
                {!product.shopify_gid && !hasAllRequiredMetafields && (
                  <p className="text-sm text-amber-400">
                    Fill all metafields to enable No GID.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
                  <label className="flex flex-col gap-1 md:col-span-4">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Title</span>
                    {editingProductField === "title" ? (
                      <div ref={editingProductField === "title" ? productFieldEditorRef : null} className="flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={productForm.title}
                          onChange={(e) => setProductForm((prev) => ({ ...prev, title: e.target.value }))}
                          disabled={savingProduct}
                          className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingProductField(null)}
                          className="text-xs px-3 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProductField("title")}
                        className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left text-sm text-gray-100 hover:border-gray-500 transition-colors"
                      >
                        <div dangerouslySetInnerHTML={{ __html: formatMetafieldPreviewHtml(productForm.title) }} />
                      </button>
                    )}
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Status</span>
                    <select
                      value={productForm.status}
                      onChange={(e) => setProductForm((prev) => ({ ...prev, status: e.target.value }))}
                      disabled={savingProduct}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="ACTIVE">ACTIVE</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Price</span>
                    <input
                      type="number"
                      step="5"
                      value={productForm.price}
                      onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                      disabled={savingProduct}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                    />
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Compare At Price</span>
                    <input
                      type="number"
                      step="5"
                      value={productForm.compare_at_price}
                      onChange={(e) => setProductForm((prev) => ({ ...prev, compare_at_price: e.target.value }))}
                      disabled={savingProduct}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                    />
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Template Suffix</span>
                    <input
                      type="text"
                      value={productForm.template_suffix}
                      onChange={(e) => setProductForm((prev) => ({ ...prev, template_suffix: e.target.value }))}
                      disabled={savingProduct}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                    />
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Description</span>
                    {editingProductField === "description" ? (
                      <div ref={editingProductField === "description" ? productFieldEditorRef : null} className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          value={productForm.description}
                          onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                          disabled={savingProduct}
                          rows={8}
                          className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70 resize-y"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingProductField(null)}
                            className="text-xs px-3 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProductField("description")}
                        className="min-h-28 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left hover:border-gray-500 transition-colors"
                      >
                        <div className="max-h-48 overflow-y-auto pr-1">
                          <div className="prose prose-invert prose-sm max-w-none text-sm text-gray-100" dangerouslySetInnerHTML={{ __html: formatMetafieldPreviewHtml(productForm.description) }} />
                        </div>
                      </button>
                    )}
                  </label>
                  {product.description && (
                    <button
                      onClick={() => setDescModalOpen(true)}
                      className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-6"
                      title="View full description"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-700/80 pt-4">
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Metafields</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    {METAFIELD_DEFINITIONS.map((field) => (
                      <label
                        key={field.key}
                        className={`flex flex-col gap-1 ${
                          THREE_COLUMN_METAFIELDS.has(field.key)
                            ? "md:col-span-2"
                            : TWO_COLUMN_METAFIELDS.has(field.key)
                              ? "md:col-span-3"
                              : field.multiline
                                ? "md:col-span-6"
                                : "md:col-span-3"
                        }`}
                      >
                        <span className="text-xs text-gray-500 uppercase tracking-wider">{field.label}</span>
                        {field.type === "file_reference" ? (
                          editingMetafield === field.key ? (
                            <div ref={editingMetafield === field.key ? metafieldEditorRef : null} className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={metafieldForm[field.key]}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setMetafieldForm((prev) => ({ ...prev, [field.key]: nextValue }));
                                    setMetafieldImagePreview((prev) => ({ ...prev, [field.key]: isImageUrl(nextValue) ? nextValue : prev[field.key] && nextValue === "" ? "" : prev[field.key] }));
                                  }}
                                  disabled={savingProduct || metafieldImageUploading}
                                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                                />
                                <button
                                  type="button"
                                  onClick={() => setMetafieldImagePicker(field.key)}
                                  disabled={savingProduct || metafieldImageUploading}
                                  className="text-xs px-3 py-2 rounded border border-blue-700 text-blue-400 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50 transition-colors"
                                >
                                  {metafieldImageUploading && metafieldImagePicker === field.key ? "Uploading…" : "Choose"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMetafield(null)}
                                  className="text-xs px-3 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                                >
                                  Done
                                </button>
                              </div>
                              {metafieldImagePreview[field.key] ? (
                                <button
                                  type="button"
                                  onClick={() => setLightbox({ images: [metafieldImagePreview[field.key]], index: 0 })}
                                  className="self-start mt-1"
                                  title="Preview image"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={metafieldImagePreview[field.key]} alt={field.label} className="h-16 w-16 rounded-lg border border-gray-700 object-cover" />
                                </button>
                              ) : metafieldForm[field.key] ? (
                                <span className="mt-1 text-xs text-gray-500">Shopify image GID selected</span>
                              ) : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingMetafield(field.key)}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left hover:border-gray-500 transition-colors"
                            >
                              {metafieldImagePreview[field.key] ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={metafieldImagePreview[field.key]} alt={field.label} className="h-20 w-20 rounded-lg border border-gray-700 object-cover mb-2" />
                                  <span className="block text-xs text-gray-500">Click to change image</span>
                                </>
                              ) : metafieldForm[field.key] ? (
                                <>
                                  <span className="block text-sm text-gray-100 break-all">{metafieldForm[field.key]}</span>
                                  <span className="block mt-1 text-xs text-gray-500">Click to edit</span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-500">Click to choose image</span>
                              )}
                            </button>
                          )
                        ) : field.multiline ? (
                          editingMetafield === field.key ? (
                            <div ref={editingMetafield === field.key ? metafieldEditorRef : null} className="flex flex-col gap-2">
                              <textarea
                                autoFocus
                                value={metafieldForm[field.key]}
                                onChange={(e) => setMetafieldForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                disabled={savingProduct}
                                rows={field.type === "multi_line_text_field" ? 6 : 5}
                                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70 resize-y"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingMetafield(null)}
                                  className="text-xs px-3 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingMetafield(field.key)}
                              className="min-h-28 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left hover:border-gray-500 transition-colors"
                            >
                              <div
                                className="prose prose-invert prose-sm max-w-none overflow-x-auto text-sm text-gray-100"
                                dangerouslySetInnerHTML={{
                                  __html: formatMetafieldPreviewHtml(
                                    metafieldForm[field.key],
                                    field.key !== "tabel_specificatii_tehnice_multiline"
                                  ),
                                }}
                              />
                            </button>
                          )
                        ) : (
                          editingMetafield === field.key ? (
                            <div ref={editingMetafield === field.key ? metafieldEditorRef : null} className="flex gap-2">
                              <input
                                type="text"
                                autoFocus
                                value={metafieldForm[field.key]}
                                onChange={(e) => setMetafieldForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                disabled={savingProduct}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 disabled:opacity-70"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingMetafield(null)}
                                className="text-xs px-3 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingMetafield(field.key)}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-left text-sm text-gray-100 hover:border-gray-500 transition-colors"
                            >
                              {metafieldForm[field.key] || "Click to edit"}
                            </button>
                          )
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
          {links !== null && (
            <div className="shrink-0" style={{ width: 250 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Product Links</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImagesSidebarOpen((prev) => {
                        const next = !prev;
                        if (!next) setSelectedSidebarImages(new Set());
                        return next;
                      });
                    }}
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
                              className={`text-xs px-2 py-1 rounded border disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${fetchingLinkIds.has(linkId) ? "border-blue-500 text-blue-300" : isFetched ? "border-blue-700 text-blue-400 hover:border-blue-500 hover:text-blue-300" : "border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300"}`}
                              title="Refresh fetch"
                            >
                              {fetchingLinkIds.has(linkId) ? "Refreshing…" : "Refresh Fetch"}
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
        const groups = linkImageGroups;
        const allImages = groups.flatMap((g) => g.images);
        let globalIndex = 0;
        return (
          <div className="shrink-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden sticky top-4" style={{ width: 640, maxHeight: "calc(100vh - 2rem)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">All Images</h2>
                <div className="flex items-center gap-2">
                  {selectedSidebarImages.size > 0 && (
                    <>
                      <span className="text-[11px] text-gray-400">{selectedSidebarImages.size} selected</span>
                      <button
                        onClick={handleAddImages}
                        disabled={addingImages || deletingLinkImages}
                        className="text-xs px-2 py-1 rounded border border-blue-700 text-blue-400 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50 transition-colors"
                      >
                        {addingImages ? "Adding…" : `Add (${selectedSidebarImages.size})`}
                      </button>
                      <button
                        onClick={handleDeleteLinkImages}
                        disabled={deletingLinkImages || addingImages}
                        className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:border-red-500 hover:text-red-300 disabled:opacity-50 transition-colors"
                      >
                        {deletingLinkImages ? "Removing…" : `Remove (${selectedSidebarImages.size})`}
                      </button>
                    </>
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
                            const sel = selectedSidebarImages.has(getSidebarImageKey(group.linkId, src));
                            return (
                              <div key={i} className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSidebarImageSelection(group.linkId, src);
                                  }}
                                  className={`absolute top-1 right-1 z-10 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                    sel
                                      ? "border-red-500 bg-red-500/20 text-red-200"
                                      : "border-gray-600 bg-gray-900/80 text-gray-300 hover:border-gray-400 hover:text-white"
                                  }`}
                                  title={sel ? "Deselect image" : "Select image"}
                                >
                                  {sel ? "Selected" : "Select"}
                                </button>
                                <button
                                  onClick={() => setLightbox({ images: allImages, index: startIndex + i })}
                                  onContextMenu={(e) => { e.preventDefault(); toggleSidebarImageSelection(group.linkId, src); }}
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

      {metafieldImagePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMetafieldImagePicker(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Choose image for {activeMetafieldDefinition?.label ?? "Section Image"}</h2>
              <button onClick={() => setMetafieldImagePicker(null)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
            </div>
            {linkImageGroups.length === 0 ? (
              <p className="text-sm text-gray-500">No link images available.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {linkImageGroups.map((group) => (
                  <div key={`${group.label}-${group.linkId ?? "none"}`}>
                    <p className="text-xs text-gray-500 truncate mb-2" title={group.label}>{group.label}</p>
                    <div className="grid grid-cols-4 gap-3">
                      {group.images.map((src, i) => {
                        const isActive = metafieldImagePicker ? metafieldImagePreview[metafieldImagePicker] === src : false;
                        return (
                          <button
                            key={`${group.label}-${i}`}
                            type="button"
                            onClick={() => {
                              void handleSelectMetafieldImage(src);
                            }}
                            disabled={metafieldImageUploading}
                            className={`relative overflow-hidden rounded-lg border transition-colors disabled:opacity-60 ${isActive ? "border-blue-500" : "border-gray-700 hover:border-gray-400"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`picker-${i}`} className="w-full h-28 object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
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
                        <p className="text-sm text-gray-100 whitespace-pre-wrap wrap-break-word">{String(val ?? "")}</p>
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
