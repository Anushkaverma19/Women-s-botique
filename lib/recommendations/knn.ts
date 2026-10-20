import type { ProductWithRelations } from "@/types/database";

/**
 * Standard fabric & weave dictionary identified from MEHRAÉ's catalogue materials.
 * Used for multi-hot feature encoding of the fabric/material attribute.
 */
export const KNOWN_FABRICS = [
  "silk",
  "organza",
  "crepe",
  "velvet",
  "cotton",
  "satin",
  "brass",
  "tissue",
  "net",
  "zari",
  "embroidery",
  "pearl",
  "kundan",
] as const;

/**
 * Feature weights for same-category similarity ranking:
 * - Fabric: Texture, weave, and craftsmanship compatibility
 * - Colour: Visual palette affinity
 * - Price: Economic band alignment (min-max scaled to [0, 1])
 */
export const FEATURE_WEIGHTS = {
  fabric: 1.0,
  colour: 1.0,
  price: 1.0,
};

export interface ProductSimilarityScore {
  product: ProductWithRelations;
  distance: number;
}

/**
 * Normalizes a category string value (lowercased, trimmed, hyphens/underscores uniform).
 */
export function normalizeCategoryValue(value?: string | null): string {
  if (!value) return "";
  return value.toLowerCase().trim().replace(/[-_\s]+/g, " ");
}

/**
 * Checks whether two products belong to the exact same category.
 * Inspects:
 *  1. category_id equality (UUID)
 *  2. category.id equality
 *  3. normalized category.slug equality
 *  4. normalized category.name equality
 */
export function isSameCategory(
  productA: Pick<ProductWithRelations, "category_id"> & {
    category?: { id?: string; slug?: string; name?: string } | null;
  },
  productB: Pick<ProductWithRelations, "category_id"> & {
    category?: { id?: string; slug?: string; name?: string } | null;
  }
): boolean {
  // 1. Direct category_id match
  if (productA.category_id && productB.category_id && productA.category_id === productB.category_id) {
    return true;
  }
  if (productA.category?.id && productB.category?.id && productA.category.id === productB.category.id) {
    return true;
  }

  // 2. Normalized slug match
  const slugA = normalizeCategoryValue(productA.category?.slug);
  const slugB = normalizeCategoryValue(productB.category?.slug);
  if (slugA && slugB && slugA === slugB) {
    return true;
  }

  // 3. Normalized name match
  const nameA = normalizeCategoryValue(productA.category?.name);
  const nameB = normalizeCategoryValue(productB.category?.name);
  if (nameA && nameB && nameA === nameB) {
    return true;
  }

  return false;
}

/**
 * Computes a weighted, normalized numerical feature vector for products
 * within the same category:
 *  - Colour (One-Hot Encoded from `color_family`)
 *  - Fabric (Multi-Hot Encoded from `material`)
 *  - Price (Min-Max Scaled from `base_price` within category bounds)
 */
export function buildProductFeatureVector(
  product: ProductWithRelations,
  allColors: string[],
  minPrice: number,
  maxPrice: number
): number[] {
  // 1. Colour One-Hot Encoding
  const colorNorm = (product.color_family || "").toLowerCase().trim();
  const colorVector = allColors.map((col) =>
    col === colorNorm ? Math.sqrt(FEATURE_WEIGHTS.colour) : 0
  );

  // 2. Fabric Multi-Hot Encoding (matching known catalogue textiles)
  const materialNorm = (product.material || "").toLowerCase();
  const fabricVector = KNOWN_FABRICS.map((fabric) =>
    materialNorm.includes(fabric) ? Math.sqrt(FEATURE_WEIGHTS.fabric) : 0
  );

  // 3. Numerical Price Scaling (Min-Max scaled to [0, 1])
  const priceRange = maxPrice - minPrice;
  const scaledPrice =
    priceRange > 0 ? (product.base_price - minPrice) / priceRange : 0.5;
  const priceFeature = scaledPrice * Math.sqrt(FEATURE_WEIGHTS.price);

  return [...colorVector, ...fabricVector, priceFeature];
}

/**
 * Calculates standard Euclidean distance between two feature vectors:
 * d(u, v) = sqrt( sum( (u_i - v_i)^2 ) )
 */
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Feature vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
    );
  }

  let sumSq = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Finds up to K nearest neighbor similar products from the MEHRAÉ catalogue using KNN.
 *
 * Requirements:
 * - Strictly filters products by the current product's category BEFORE applying KNN ranking.
 *   (e.g., if target is a Dress, ONLY Dresses are evaluated).
 * - Excludes the currently viewed target product.
 * - Encodes categorical fields (colour, fabric) & scales numerical price appropriately.
 * - Employs Euclidean distance over the normalized feature space.
 * - Returns up to K results, or fewer if fewer same-category products exist.
 * - Never returns products from different categories or fake recommendations.
 */
export function findKNearestSimilarProducts(
  targetProduct: ProductWithRelations,
  catalogue: ProductWithRelations[],
  k: number = 5
): ProductWithRelations[] {
  if (!targetProduct || !catalogue || catalogue.length === 0) {
    return [];
  }

  // 1. Strictly filter products by SAME CATEGORY and exclude target product BEFORE KNN
  const sameCategoryCandidates = catalogue.filter(
    (candidate) =>
      candidate.id !== targetProduct.id &&
      candidate.slug !== targetProduct.slug &&
      isSameCategory(targetProduct, candidate)
  );

  // If no other products exist in this category, return empty list
  if (sameCategoryCandidates.length === 0) {
    return [];
  }

  // 2. Discover distinct color families and price bounds within the same-category pool
  const pool = [targetProduct, ...sameCategoryCandidates];

  const allColors = Array.from(
    new Set(
      pool
        .map((p) => (p.color_family || "").toLowerCase().trim())
        .filter(Boolean)
    )
  ).sort();

  const prices = pool.map((p) => p.base_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // 3. Vectorize target product
  const targetVector = buildProductFeatureVector(
    targetProduct,
    allColors,
    minPrice,
    maxPrice
  );

  // 4. Compute KNN Euclidean distances to all same-category candidates
  const scoredCandidates: ProductSimilarityScore[] = sameCategoryCandidates.map(
    (candidate) => {
      const candidateVector = buildProductFeatureVector(
        candidate,
        allColors,
        minPrice,
        maxPrice
      );
      const distance = euclideanDistance(targetVector, candidateVector);
      return { product: candidate, distance };
    }
  );

  // 5. Sort ascending by similarity distance (closest match first) and take up to k
  scoredCandidates.sort((a, b) => a.distance - b.distance);

  return scoredCandidates.slice(0, k).map((entry) => entry.product);
}
