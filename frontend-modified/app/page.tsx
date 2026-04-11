"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        console.log("[products] status:", res.status, "data:", data);
        if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
        const items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [data]);
        setProducts(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-800 to-gray-900 flex items-stretch justify-center p-6 gap-4">
      <div className="flex-1 min-w-0 max-w-400 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Products</h1>
          <button
            onClick={async () => {
              setAddingProduct(true);
              try {
                await fetch("/api/product-add", { method: "POST" });
                await fetchProducts();
              } finally {
                setAddingProduct(false);
              }
            }}
            disabled={addingProduct}
            className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            {addingProduct ? "Adding…" : "+ Add Product"}
          </button>
        </div>
        <div className="px-6 py-4 flex-1">
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && !error && products.length === 0 && (
            <p className="text-sm text-gray-500">No products found.</p>
          )}
          {products.length > 0 && (
            <ul className="space-y-3">
              {products.map((p) => (
                <li key={p.id} className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-gray-500 text-sm font-normal mr-2">#{p.id}</span>
                      <Link
                        href={`/products/${p.id}`}
                        className="font-semibold text-gray-100 hover:text-blue-400 transition-colors"
                      >
                        {p.title}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
