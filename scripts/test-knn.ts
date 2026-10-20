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
  fabric: 1.0,
  colour: 1.0,
  price: 1.0,
};

interface TestProduct {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  material: string;
  color_family: string;
  category_id?: string;
  category?: { id?: string; name?: string; slug?: string } | null;
}

function normalizeCategoryValue(value?: string | null): string {
  if (!value) return "";
  return value.toLowerCase().trim().replace(/[-_\s]+/g, " ");
}

function isSameCategory(productA: TestProduct, productB: TestProduct): boolean {
  if (productA.category_id && productB.category_id && productA.category_id === productB.category_id) {
    return true;
  }
  if (productA.category?.id && productB.category?.id && productA.category.id === productB.category.id) {
    return true;
  }
  const slugA = normalizeCategoryValue(productA.category?.slug);
  const slugB = normalizeCategoryValue(productB.category?.slug);
  if (slugA && slugB && slugA === slugB) {
    return true;
  }
  const nameA = normalizeCategoryValue(productA.category?.name);
  const nameB = normalizeCategoryValue(productB.category?.name);
  if (nameA && nameB && nameA === nameB) {
    return true;
  }
  return false;
}

function buildProductFeatureVector(
  product: TestProduct,
  allColors: string[],
  minPrice: number,
  maxPrice: number
): number[] {
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

  return [...colorVector, ...fabricVector, priceFeature];
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
  k: number = 5
): TestProduct[] {
  // STRICT CATEGORY FILTER & SELF-EXCLUSION BEFORE KNN
  const sameCategoryCandidates = catalogue.filter(
    (candidate) =>
      candidate.id !== targetProduct.id &&
      candidate.slug !== targetProduct.slug &&
      isSameCategory(targetProduct, candidate)
  );

  if (sameCategoryCandidates.length === 0) {
    return [];
  }

  const pool = [targetProduct, ...sameCategoryCandidates];
  const allColors = Array.from(
    new Set(pool.map((p) => (p.color_family || "").toLowerCase().trim()).filter(Boolean))
  ).sort();

  const prices = pool.map((p) => p.base_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const targetVector = buildProductFeatureVector(
    targetProduct,
    allColors,
    minPrice,
    maxPrice
  );

  const scoredCandidates = sameCategoryCandidates.map((candidate) => {
    const candidateVector = buildProductFeatureVector(
      candidate,
      allColors,
      minPrice,
      maxPrice
    );
    const distance = euclideanDistance(targetVector, candidateVector);
    return { product: candidate, distance };
  });

  scoredCandidates.sort((a, b) => a.distance - b.distance);
  return scoredCandidates.slice(0, k).map((entry) => entry.product);
}

async function main() {
  console.log("=========================================================");
  console.log(" MEHRAÉ Strict Category KNN Similar Products Test Suite  ");
  console.log("=========================================================");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, material, color_family, category_id, category:categories(id, name, slug)")
    .eq("active", true);

  if (error || !data) {
    console.error("Failed to fetch MEHRAÉ catalogue:", error?.message);
    process.exit(1);
  }

  const rawList = data as unknown as Array<TestProduct & { category?: { id?: string; name?: string; slug?: string } | Array<{ id?: string; name?: string; slug?: string }> }>;
  const catalogue: TestProduct[] = rawList.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    base_price: p.base_price,
    material: p.material,
    color_family: p.color_family,
    category_id: p.category_id,
    category: Array.isArray(p.category) ? p.category[0] : p.category,
  }));

  console.log(`Loaded ${catalogue.length} active products from MEHRAÉ catalogue.\n`);

  const testCases = [
    {
      type: "Dress",
      slug: "vera-emerald-satin-wrap-dress",
      expectedCategorySlug: "dresses",
      expectedExactCount: 2, // 3 total dresses - 1 target = 2 available
    },
    {
      type: "Saree",
      slug: "noor-ivory-silk-saree",
      expectedCategorySlug: "sarees",
      expectedExactCount: 5, // 6 total sarees - 1 target = 5 available
    },
    {
      type: "Lehenga",
      slug: "kavya-emerald-festive-lehenga",
      expectedCategorySlug: "lehengas",
      expectedExactCount: 4, // 5 total lehengas - 1 target = 4 available
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`---------------------------------------------------------`);
    console.log(`Verifying Target Product Type: ${tc.type}`);
    console.log(`Target Slug: ${tc.slug}`);

    const target = catalogue.find((p) => p.slug === tc.slug);
    if (!target) {
      console.error(`FAIL: Target product '${tc.slug}' not found in catalogue.`);
      allPassed = false;
      continue;
    }

    const targetCat = normalizeCategoryValue(target.category?.slug || target.category?.name);
    console.log(`Target Category: ${targetCat} (from DB: ${target.category?.name})`);

    const similar = findKNearestSimilarProducts(target, catalogue, 5);

    console.log(`Recommended Results Count: ${similar.length}`);

    // Check 1: Target product must NOT be in recommendations
    const containsSelf = similar.some((p) => p.id === target.id || p.slug === target.slug);
    if (containsSelf) {
      console.error("FAIL: Target product is included in its own recommendations!");
      allPassed = false;
    } else {
      console.log("PASS: Target product is excluded from recommendations.");
    }

    // Check 2: STRICT Category check — EVERY recommended product MUST belong to target's category
    const anyCrossCategory = similar.some((p) => !isSameCategory(target, p));
    if (anyCrossCategory) {
      console.error(`FAIL: Cross-category recommendation detected! Expected only '${targetCat}'.`);
      allPassed = false;
    } else {
      console.log(`PASS: 100% of recommendations belong strictly to category '${targetCat}'.`);
    }

    // Check 3: Count check — up to 5, or exact available matches
    if (similar.length > 5) {
      console.error(`FAIL: Exceeded max 5 items: returned ${similar.length}`);
      allPassed = false;
    } else if (similar.length !== tc.expectedExactCount) {
      console.error(`FAIL: Expected exactly ${tc.expectedExactCount} available same-category items, got ${similar.length}`);
      allPassed = false;
    } else {
      console.log(`PASS: Correct count returned (${similar.length} items; all available same-category matches).`);
    }

    // Print recommendations
    similar.forEach((p, idx) => {
      console.log(
        `  ${idx + 1}. ${p.name} | Category: ${p.category?.name} | Color: ${p.color_family} | Material: ${p.material} | Price: ₹${p.base_price}`
      );
    });
  }

  console.log(`=========================================================`);
  if (allPassed) {
    console.log(" ALL STRICT CATEGORY KNN TESTS PASSED SUCCESSFULLY!     ");
    console.log("=========================================================");
  } else {
    console.error(" SOME CHECKS FAILED.");
    console.log("=========================================================");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite runtime error:", err);
  process.exit(1);
});
