import { useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

type ProductSummary = {
  id: string;
  title: string;
  handle: string;
  status: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const selectedProductId = url.searchParams.get("product") || "";

  const response = await admin.graphql(`
    #graphql
    query ProductPickerProducts {
      products(first: 100) {
        edges {
          node {
            id
            title
            handle
            status
          }
        }
      }
    }
  `);

  const responseJson = (await response.json()) as {
    data?: {
      products?: {
        edges?: Array<{ node: ProductSummary }>;
      };
    };
  };

  const products = (responseJson.data?.products?.edges || []).map(({ node }) => node);

  return {
    products,
    selectedProductId,
  };
};

export default function AdditionalPage() {
  const { products, selectedProductId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    selectedProductId || products[0]?.id || "",
  );

  useEffect(() => {
    if (!selectedId && products[0]?.id) {
      setSelectedId(selectedProductId || products[0].id);
    }
  }, [products, selectedId, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      return `${product.title} ${product.handle} ${product.status}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [products, query]);

  const activeProduct = products.find((product) => product.id === selectedId) || null;

  const setCurrentProduct = () => {
    if (!selectedId) {
      return;
    }

    navigate(`/app/additional?product=${encodeURIComponent(selectedId)}`);

    if (activeProduct) {
      shopify.toast.show(`Working on ${activeProduct.title}`);
    }
  };

  return (
    <s-page heading="Product workspace">
      <s-section heading="Choose a product">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Search the catalog and set the product you want to work on.
          </s-paragraph>

          <s-search-field
            label="Search products"
            value={query}
            placeholder="Search by title, handle, or status"
            onChange={(event) => setQuery(event.currentTarget.value)}
          ></s-search-field>

          <s-select
            label="Products"
            value={selectedId}
            onChange={(event) => setSelectedId(event.currentTarget.value)}
          >
            {filteredProducts.length === 0 ? (
              <s-option value="">No products found</s-option>
            ) : (
              filteredProducts.map((product) => (
                <s-option key={product.id} value={product.id}>
                  {product.title} ({product.status.toLowerCase()})
                </s-option>
              ))
            )}
          </s-select>

          <s-button
            variant="primary"
            onClick={setCurrentProduct}
            disabled={!selectedId}
          >
            Set current product
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Current selection">
        <s-box padding="base" background="subdued" border="base">
          {activeProduct ? (
            <s-stack direction="block" gap="base">
              <s-text type="strong">{activeProduct.title}</s-text>
              <s-text>Handle: {activeProduct.handle}</s-text>
              <s-text>Status: {activeProduct.status}</s-text>
            </s-stack>
          ) : (
            <s-text>No product selected yet.</s-text>
          )}
        </s-box>
      </s-section>
    </s-page>
  );
}
