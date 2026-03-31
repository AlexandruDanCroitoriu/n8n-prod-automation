### Mutation for creating a product
```js
mutation CreateProductWithMedia($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
  productCreate(product: $product, media: $media) {
    product {
      id
      title
      descriptionHtml
      status
      templateSuffix
      variants(first: 1) {
        nodes {
          id
          price
          compareAtPrice
        }
      }
      media(first: 30) {
        nodes {
          id
          alt
          mediaContentType
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```
#### Set Variables
```json
{
  "product": {
    "title": "product with images 2",
    "descriptionHtml": "<p>Product description from graphql</p>",
    "status": "DRAFT",
    "templateSuffix": "pagepilot-Standard-GLOBAL"
  },
  "media": [
    {
      "originalSource": "https://nobili-design.com/storage/pages/841/lg/3054Modern_living_rooms_furniture_Francesco.webp",
      "alt": "Main product image",
      "mediaContentType": "IMAGE"
    }
  ]
}
```

Use the returned `product.media.nodes[].id` values if you want to reuse those uploaded images later in `file_reference` metafields.

### Update product variant pricing (price and compare-at price)
```js
mutation UpdateVariantPricing($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants {
      id
      price
      compareAtPrice
    }
    userErrors {
      field
      message
    }
  }
}
```

#### Set Variables
```json
{
  "productId": "gid://shopify/Product/<PRODUCT_ID>",
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/<VARIANT_ID>",
      "price": "99.00",
      "compareAtPrice": "199.00"
    }
  ]
}
```

### Mutation for updating metafields of a product
```js
mutation UpdateProductMetafield($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      key
      value
    }
    userErrors {
      field
      message
    }
  }
}
```

#### Update product metafields with variables in two batches (due to 25 metafields limit per mutation). Set the product id in the variables <PRODUCT_ID> and also the <IMAGE_ID> for the seccond batch.
```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "beneficiu_1",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<BENEFIT_1>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "beneficiu_2",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<BENEFIT_2>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "beneficiu_3",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<BENEFIT_3>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "beneficiu_4",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<BENEFIT_4>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_1_title",
      "type": "single_line_text_field",
      "value": "<SECTION_1_TITLE>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_1_description",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<SECTION_1_DESCRIPTION>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_2_title",
      "type": "single_line_text_field",
      "value": "<SECTION_2_TITLE>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_2_description",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<SECTION_2_DESCRIPTION>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_3_title",
      "type": "single_line_text_field",
      "value": "<SECTION_3_TITLE>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_3_description",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<SECTION_3_DESCRIPTION>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_1_text",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<REV_1_TEXT>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_1_name",
      "type": "single_line_text_field",
      "value": "<REV_1_NAME>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_2_text",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<REV_2_TEXT>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_2_name",
      "type": "single_line_text_field",
      "value": "<REV_2_NAME>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_3_text",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<REV_3_TEXT>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_3_name",
      "type": "single_line_text_field",
      "value": "<REV_3_NAME>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_4_text",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<REV_4_TEXT>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_4_name",
      "type": "single_line_text_field",
      "value": "<REV_4_NAME>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_5_text",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<REV_5_TEXT>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_5_name",
      "type": "single_line_text_field",
      "value": "<REV_5_NAME>"
    }
  ]
}
```
```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_1_q",
      "type": "single_line_text_field",
      "value": "<FAQ_1_QUESTION>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_1_a",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<FAQ_1_ANSWER>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_2_q",
      "type": "single_line_text_field",
      "value": "<FAQ_2_QUESTION>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_2_a",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<FAQ_2_ANSWER>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_3_q",
      "type": "single_line_text_field",
      "value": "<FAQ_3_QUESTION>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_3_a",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<FAQ_3_ANSWER>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_4_q",
      "type": "single_line_text_field",
      "value": "<FAQ_4_QUESTION>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "faq_4_a",
      "type": "rich_text_field",
      "value": "{\"type\":\"root\",\"children\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"text\",\"value\":\"<FAQ_4_ANSWER>\"}]}]}"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_5_img",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_4_img",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_3_img",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_2_img",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "rev_1_img",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_3_image",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_2_image",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    },
    {
      "ownerId": "gid://shopify/Product/<PRODUCT_ID>",
      "namespace": "custom",
      "key": "section_1_image",
      "type": "file_reference",
      "value": "gid://shopify/MediaImage/<IMAGE_ID>"
    }
  ]
}
```