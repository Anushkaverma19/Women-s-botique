import { createClient } from "@supabase/supabase-js";

/**
 * Standard fabric & weave dictionary identified from MEHRAÉ's catalogue materials.
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

const FEATURE_WEIGHTS = {
  category: 2.0,
  fabric: 1.0,
  colour: 1.0,
  price: 1.0,
};

const MAX_SUITABILITY_DISTANCE = 2.8;

interface TestProduct {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  material: string;
  color_family: string;
  category?: { name: string; slug: string } | null;
}

function buildProductFeatureVector(
  product: TestProduct,
  allCategories: string[],
  allColors: string[],
  minPrice: number,
  maxPrice: number
): number[] {
  const catSlug = product.category?.slug?.toLowerCase() || "";
  const catVector = allCategories.map((c) =>
    c === catSlug ? Math.sqrt(FEATURE_WEIGHTS.category) : 0
  );

  const colorNorm = (product.color_family || "").toLowerCase().trim();
  const colorVector = allColors.map((col) =>
    col === colorNorm ? Math.sqrt(FEATURE_WEIGHTS.colour) : 0
  );

  const materialNorm = (product.material || "").toLowerCase();
  const fabricVector = KNOWN_FABRICS.map((fabric) =>
    materialNorm.includes(fabric) ? Math.sqrt(FEATURE_WEIGHTS.fabric) : 0
  );

  const priceRange = maxPrice - minPrice;
  const scaledPrice =
    priceRange > 0 ? (product.base_price - minPrice) / priceRange : 0.5;
  const priceFeature = scaledPrice * Math.sqrt(FEATURE_WEIGHTS.price);

  return [...catVector, ...colorVector, ...fabricVector, priceFeature];
}

function euclideanDistance(vecA: number[], vecB: number[]): number {
  let sumSq = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

function findKNearestSimilarProducts(
  targetProduct: TestProduct,
  catalogue: TestProduct[],
  k: number = 5,
  maxDistanceThreshold: number = MAX_SUITABILITY_DISTANCE
): TestProduct[] {
  const candidates = catalogue.filter((p) => p.id !== targetProduct.id);
  if (candidates.length === 0) return [];

  const allProducts = [targetProduct, ...candidates];

  const allCategories = Array.from(
    new Set(allProducts.map((p) => p.category?.slug?.toLowerCase() || "").filter(Boolean))
  ).sort();

  const allColors = Array.from(
    new Set(allProducts.map((p) => (p.color_family || "").toLowerCase().trim()).filter(Boolean))
  ).sort();

  const prices = allProducts.map((p) => p.base_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const targetVector = buildProductFeatureVector(
    targetProduct,
    allCategories,
    allColors,
    minPrice,
    maxPrice
  );

  const scoredCandidates = candidates.map((candidate) => {
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

  const suitableCandidates = scoredCandidates
    .filter((entry) => entry.distance <= maxDistanceThreshold)
    .sort((a, b) => a.distance - b.distance);

  const finalMatches =
    suitableCandidates.length > 0
      ? suitableCandidates.slice(0, k)
      : scoredCandidates.sort((a, b) => a.distance - b.distance).slice(0, k);

  return finalMatches.map((entry) => entry.product);
}

async function main() {
  console.log("==================================================");
  console.log(" MEHRAÉ KNN Similar Products Verification Suite  ");
  console.log("==================================================");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, material, color_family, category:categories(name, slug)")
    .eq("active", true);

  if (error || !data) {
    console.error("Failed to fetch MEHRAÉ catalogue:", error?.message);
    process.exit(1);
  }

  const rawList = data as unknown as Array<TestProduct & { category?: { name: string; slug: string } | Array<{ name: string; slug: string }> }>;
  const catalogue: TestProduct[] = rawList.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    base_price: p.base_price,
    material: p.material,
    color_family: p.color_family,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  }));

  console.log(`Loaded ${catalogue.length} active products from MEHRAÉ catalogue.\n`);

  const testCases = [
    {
      title: "Test Case 1: Mulberry Silk Saree with Zari Border",
      slug: "noor-ivory-silk-saree",
      expectedCategory: "sarees",
    },
    {
      title: "Test Case 2: Emerald Silk Festive Lehenga",
      slug: "kavya-emerald-festive-lehenga",
      expectedCategory: "lehengas",
    },
    {
      title: "Test Case 3: Emerald Satin Wrap Dress",
      slug: "vera-emerald-satin-wrap-dress",
      expectedCategory: "dresses",
    },
    {
      title: "Test Case 4: Bridal Kundan & Pearl Jewellery Set",
      slug: "aafreen-bridal-jewellery-set",
      expectedCategory: "jewellery",
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`--------------------------------------------------`);
    console.log(tc.title);
    console.log(`Target Slug: ${tc.slug}`);

    const target = catalogue.find((p) => p.slug === tc.slug);
    if (!target) {
      console.error(`FAIL: Target product '${tc.slug}' not found in catalogue.`);
      allPassed = false;
      continue;
    }

    const similar = findKNearestSimilarProducts(target, catalogue, 5);

    console.log(`Results Returned: ${similar.length} products`);

    // Check 1: Target product must NOT be in recommendations
    const containsSelf = similar.some((p) => p.id === target.id || p.slug === target.slug);
    if (containsSelf) {
      console.error("FAIL: Target product is included in its own recommendations!");
      allPassed = false;
    } else {
      console.log("PASS: Target product is excluded from recommendations.");
    }

    // Check 2: All returned products must exist in catalogue
    const catalogueIds = new Set(catalogue.map((p) => p.id));
    const allExist = similar.every((p) => catalogueIds.has(p.id));
    if (!allExist) {
      console.error("FAIL: Some recommended products do not exist in catalogue!");
      allPassed = false;
    } else {
      console.log("PASS: All displayed products exist in the MEHRAÉ catalogue.");
    }

    // Check 3: At most 5 recommendations, and if fewer suitable exist, return available matches
    if (similar.length > 5) {
      console.error(`FAIL: More than 5 recommendations returned (${similar.length}).`);
      allPassed = false;
    } else {
      console.log(`PASS: Count constraint satisfied (${similar.length} <= 5).`);
    }

    // Check 4: For jewellery, only 1 other jewellery product exists in catalogue
    if (tc.expectedCategory === "jewellery") {
      if (similar.length === 1 && similar[0].slug === "aafreen-pearl-statement-earrings") {
        console.log("PASS: Jewellery test returned only the 1 available catalogue match without fake padding.");
      }
    }

    // Print matches
    similar.forEach((p, idx) => {
      console.log(
        `  ${idx + 1}. ${p.name} | Cat: ${p.category?.name || "N/A"} | Color: ${p.color_family} | Material: ${p.material} | Price: ₹${p.base_price}`
      );
    });
  }

  console.log(`==================================================`);
  if (allPassed) {
    console.log(" ALL KNN VERIFICATION CHECKS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } else {
    console.error(" SOME CHECKS FAILED.");
    console.log("==================================================");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
