import type { ProductWithRelations } from "@/types/database";

/**
 * Standard fabric & weave dictionary identified from MEHRAÉ's catalogue materials.
 * Used for multi-hot feature encoding of the fabric/material attribute.
 */
const KNOWN_FABRICS = [
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
 * Feature weights balancing categorical and numerical influence:
 * - Category: Strong structural alignment for garment type
 * - Fabric: Texture and weave compatibility
 * - Colour: Visual tone affinity
 * - Price: Economic band alignment (min-max scaled)
 */
const FEATURE_WEIGHTS = {
  category: 2.0,
  fabric: 1.0,
  colour: 1.0,
  price: 1.0,
};

/**
 * Cutoff distance threshold for suitable matches.
 * Distance between mismatched categories starts around ~2.83+,
 * so a threshold of 2.8 ensures we return only genuinely suitable matches.
 * If fewer than 5 suitable products exist, only the available matches are shown.
 */
const MAX_SUITABILITY_DISTANCE = 2.8;

export interface ProductSimilarityScore {
  product: ProductWithRelations;
  distance: number;
}

/**
 * Computes a weighted, normalized numerical feature vector for a MEHRAÉ product.
 * Features used:
 *  - Category (One-Hot Encoded)
 *  - Colour (One-Hot Encoded from `color_family`)
 *  - Fabric (Multi-Hot Encoded from `material`)
 *  - Price (Min-Max Scaled from `base_price`)
 */
export function buildProductFeatureVector(
  product: ProductWithRelations,
  allCategories: string[],
  allColors: string[],
  minPrice: number,
  maxPrice: number
): number[] {
  // 1. Category One-Hot Encoding
  const catSlug = product.category?.slug?.toLowerCase() || "";
  const catVector = allCategories.map((c) =>
    c === catSlug ? Math.sqrt(FEATURE_WEIGHTS.category) : 0
  );

  // 2. Colour One-Hot Encoding
  const colorNorm = (product.color_family || "").toLowerCase().trim();
  const colorVector = allColors.map((col) =>
    col === colorNorm ? Math.sqrt(FEATURE_WEIGHTS.colour) : 0
  );

  // 3. Fabric Multi-Hot Encoding (matching known catalogue textiles)
  const materialNorm = (product.material || "").toLowerCase();
  const fabricVector = KNOWN_FABRICS.map((fabric) =>
    materialNorm.includes(fabric) ? Math.sqrt(FEATURE_WEIGHTS.fabric) : 0
  );

  // 4. Numerical Price Scaling (Min-Max scaled to [0, 1])
  const priceRange = maxPrice - minPrice;
  const scaledPrice =
    priceRange > 0 ? (product.base_price - minPrice) / priceRange : 0.5;
  const priceFeature = scaledPrice * Math.sqrt(FEATURE_WEIGHTS.price);

  return [...catVector, ...colorVector, ...fabricVector, priceFeature];
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
 * - Uses ONLY actual catalogue products (no synthetic/fake products).
 * - Excludes the currently viewed target product.
 * - Encodes categorical fields (category, colour, fabric) & scales price appropriately.
 * - Employs Euclidean distance over the normalized feature space.
 * - If fewer than K suitable products exist in the catalogue, returns only available matches.
 */
export function findKNearestSimilarProducts(
  targetProduct: ProductWithRelations,
  catalogue: ProductWithRelations[],
  k: number = 5,
  maxDistanceThreshold: number = MAX_SUITABILITY_DISTANCE
): ProductWithRelations[] {
  if (!targetProduct || !catalogue || catalogue.length === 0) {
    return [];
  }

  // 1. Exclude the target product itself
  const candidates = catalogue.filter((p) => p.id !== targetProduct.id);
  if (candidates.length === 0) {
    return [];
  }

  // 2. Discover distinct categorical domains and price range across full catalogue
  const allProducts = [targetProduct, ...candidates];

  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => p.category?.slug?.toLowerCase() || "")
        .filter(Boolean)
    )
  ).sort();

  const allColors = Array.from(
    new Set(
      allProducts
        .map((p) => (p.color_family || "").toLowerCase().trim())
        .filter(Boolean)
    )
  ).sort();

  const prices = allProducts.map((p) => p.base_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // 3. Vectorize target product
  const targetVector = buildProductFeatureVector(
    targetProduct,
    allCategories,
    allColors,
    minPrice,
    maxPrice
  );

  // 4. Compute distances to all candidates
  const scoredCandidates: ProductSimilarityScore[] = candidates.map((candidate) => {
    const candidateVector = buildProductFeatureVector(
      candidate,
      allCategories,
      allColors,
      minPrice,
      maxPrice
    );
    const distance = euclideanDistance(targetVector, candidateVector);
    return { product: candidate, distance };
  });

  // 5. Filter for suitable matches (within max suitability distance) and sort ascending
  const suitableCandidates = scoredCandidates
    .filter((entry) => entry.distance <= maxDistanceThreshold)
    .sort((a, b) => a.distance - b.distance);

  // If suitable candidates are found, take up to k;
  // If strict threshold yielded nothing (e.g. extremely isolated single-item category),
  // fallback gracefully to nearest candidates without generating fake data
  const finalMatches =
    suitableCandidates.length > 0
      ? suitableCandidates.slice(0, k)
      : scoredCandidates.sort((a, b) => a.distance - b.distance).slice(0, k);

  return finalMatches.map((entry) => entry.product);
}
