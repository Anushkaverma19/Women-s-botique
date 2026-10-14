import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score

DATASET_FILE = "flipkart_fashion_products_dataset.json"
MODEL_OUTPUT_FILE = "mehrae_search_model.pkl"
META_OUTPUT_FILE = "mehrae_search_model_meta.json"

# Mapping Flipkart sub_categories & boutique intents to MEHRAÉ core categories
MEHRAE_CATEGORY_MAP = {
    # Sarees
    "Sarees": "sarees",
    "Fabrics": "sarees",
    # Lehengas
    "Lehengas": "lehengas",
    # Dresses & Ethnic Outfits
    "Kurtas, Ethnic Sets and Bottoms": "dresses",
    "Topwear": "dresses",
    "Blazers, Waistcoats and Suits": "dresses",
    "Bottomwear": "dresses",
    "Winter Wear": "dresses",
    "Dresses": "dresses",
    # Jewellery & Accessories
    "Clothing Accessories": "jewellery",
    "Jewellery": "jewellery",
    "Bags, Wallets & Belts": "jewellery",
    # Footwear & General
    "Men's Footwear": "dresses",
    "Innerwear and Swimwear": "dresses",
    "Sleepwear": "dresses",
    "Tracksuits": "dresses",
    "Other": "dresses",
}

# MEHRAÉ Ethnic Boutique domain augmentation samples
# This ensures ethnic queries (sarees, lehengas, bridal jewellery, anarkalis)
# are accurately recognized alongside the Flipkart catalogue features.
ETHNIC_BOUTIQUE_SAMPLES = [
    # Sarees
    ("Noor Ivory Silk Saree pure mulberry silk with zari border temple mornings candlelit receptions", "Sarees"),
    ("Gulabi Tissue Saree rose pink woven tissue silk banarasi zari border festive cocktail drape", "Sarees"),
    ("Chandrika Organza Saree hand embroidered floral scalloped silk organza daytime wedding pooja", "Sarees"),
    ("Kanjivaram Silk Saree traditional pure silk golden zari weave temple border bridal drape", "Sarees"),
    ("Banarasi Katan Silk Saree rich kadwa weave floral jaal wedding ceremony heritage drape", "Sarees"),
    ("Chanderi Cotton Silk Saree lightweight pastel drape golden booti summer festive wear", "Sarees"),
    ("Tussar Silk Handloom Saree natural golden sheen tribal kantha embroidery festive wear", "Sarees"),
    ("Georgette Pre-Draped Saree modern pleated drape with embroidered belt cocktail evening wear", "Sarees"),
    ("Red Bridal Saree scarlet red silk with intricate zardozi and gold sequin border bride", "Sarees"),
    ("Pashmina Silk Saree kashmiri aari embroidery royal winter festive drape", "Sarees"),
    ("Royal Blue Paithani Saree peacock motif pallu pure silk gold zari border", "Sarees"),
    ("Yellow Haldi Silk Saree auspicious mustard drape temple weave festive morning", "Sarees"),

    # Lehengas
    ("Sitara Velvet Bridal Lehenga deep crimson micro-velvet zardozi pita hand embroidery royal bride", "Lehengas"),
    ("Mehrunissa Raw Silk Lehenga heirloom sindoor red dabka cutdana handcraft bridal wedding", "Lehengas"),
    ("Zubeida Organza Lehenga pastel mint green gota patti tiered volume sangeet mehendi festive", "Lehengas"),
    ("Roshni Sequin Silk Lehenga champagne gold mirror work crystal detailing reception engagement", "Lehengas"),
    ("Bandhani Chaniya Choli Lehenga pure gajji silk traditional festive navratri garba wedding", "Lehengas"),
    ("Floral Printed Silk Lehenga organza cancan flare embroidered bustier summer bridesmaid", "Lehengas"),
    ("Maroon Embroidered Bridal Lehenga heavy kalidar flare velvet choli net dupatta", "Lehengas"),
    ("Lavender Chikankari Lehenga lucknowi thread embroidery pearls mukaish work sangeet bride", "Lehengas"),
    ("Peacock Blue Brocade Lehenga woven banarasi silk flare contrast blouse festive cocktail", "Lehengas"),
    ("Emerald Green Velvet Lehenga antique gold zardozi winter bridal reception outfit", "Lehengas"),

    # Dresses & Kurtas
    ("Anarkali Kurta Set pure chanderi flared silhouette with gota lace and organza dupatta", "Dresses"),
    ("Sharara Suit Set embroidered short peplum kurta with flared sharara pants sangeet wear", "Dresses"),
    ("Gharara Ethnic Set royal silk kurti paired with pleated knee-flared gharara and dupatta", "Dresses"),
    ("Contemporary Ethnic Indo-Western Dress cape sleeve cowl drape silk blend cocktail gown", "Dresses"),
    ("Straight Cut Silk Kurta Pant Set pastel ivory minimal threadwork workwear festive", "Dresses"),
    ("Floor Length Ethnic Gown embroidered bodice draped georgette flare evening reception", "Dresses"),
    ("Angrakha Style Kurta festive tie-up flared silhouette with block print and tassels", "Dresses"),
    ("Velvet Kaftan Dress jewel tone embroidered neckline relaxed festive luxury lounger", "Dresses"),
    ("Dhoti Pant Kurta Set modern draped dhoti with structured asymmetric silk tunic", "Dresses"),
    ("Embroidered Jacket Dress layered silk inner slip with floor length embellished shrug", "Dresses"),

    # Jewellery & Accessories
    ("Noor Polki Choker Necklace 22k gold plated uncut polki pearls emerald drop bridal jewellery", "Jewellery"),
    ("Mayur Kundan Jhumkas antique gold filigree handcrafted pearls heritage earrings wedding", "Jewellery"),
    ("Chandbali Pearl Earrings crescent moon kundan meenakari detailing festive statement", "Jewellery"),
    ("Royal Jadau Temple Necklace choker featuring ruby stones and goddess motifs bridal", "Jewellery"),
    ("Kundan Matha Patti Maang Tikka bridal hair ornament with pearl strands and gemstones", "Jewellery"),
    ("Gold Plated Kada Bangles pair of openable embossed filigree bracelets festive wear", "Jewellery"),
    ("Hathphool Bridal Hand Harness delicate pearl chains and kundan rings wedding bride", "Jewellery"),
    ("Meenakari Choker Set vibrant enamel work matching earrings bridal trousseau luxury", "Jewellery"),
    ("Emerald Solitaire Statement Ring handcrafted cocktail jewelry bridal accessory", "Jewellery"),
    ("Pearl Nose Ring Nath traditional bridal clip-on nath with floral kundan drop", "Jewellery"),
]

def load_and_preprocess_data():
    print(f"Loading dataset from {DATASET_FILE}...", flush=True)
    start_time = time.time()
    
    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        raw_items = json.load(f)
    print(f"Loaded {len(raw_items)} raw items in {time.time() - start_time:.2f}s", flush=True)

    records = []
    for item in raw_items:
        title = str(item.get("title") or "").strip()
        desc = str(item.get("description") or "").strip()
        sub_cat = str(item.get("sub_category") or "").strip()
        cat = str(item.get("category") or "").strip()

        if not sub_cat:
            sub_cat = cat if cat else "Other"

        # Group very rare sub-categories
        if "Bags, Wallets" in sub_cat:
            sub_cat = "Clothing Accessories"
        elif "Clothing and Accessories" in sub_cat:
            sub_cat = "Topwear"

        text = f"{title} {desc}".strip()
        if len(text) >= 5:
            records.append({"text": text, "sub_category": sub_cat, "category": cat})

    df = pd.DataFrame(records)
    print(f"Valid dataset records: {len(df)}", flush=True)

    # Filter out categories with fewer than 10 samples for robust classification
    sub_counts = df["sub_category"].value_counts()
    valid_sub_cats = sub_counts[sub_counts >= 10].index.tolist()
    df = df[df["sub_category"].isin(valid_sub_cats)].copy()

    # Augment with ethnic boutique domain samples
    ethnic_records = []
    for text, sub_cat in ETHNIC_BOUTIQUE_SAMPLES:
        # Replicate boutique samples to ensure balanced signal for ethnic terms
        for _ in range(25):
            ethnic_records.append({
                "text": text,
                "sub_category": sub_cat,
                "category": "Clothing and Accessories" if sub_cat != "Jewellery" else "Jewellery"
            })
    
    df_ethnic = pd.DataFrame(ethnic_records)
    df_combined = pd.concat([df, df_ethnic], ignore_index=True)
    print(f"Total training records (with boutique ethnic augmentation): {len(df_combined)}", flush=True)
    print("Classes in target:", df_combined["sub_category"].value_counts().to_dict(), flush=True)

    return df_combined

def train():
    df = load_and_preprocess_data()
    X = df["text"]
    y = df["sub_category"]

    print("Splitting into train/test sets (80/20)...", flush=True)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Building TF-IDF + Logistic Regression pipeline...", flush=True)
    pipeline = Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                max_features=15000,
                ngram_range=(1, 2),
                stop_words="english",
                sublinear_tf=True,
                lowercase=True,
            ),
        ),
        (
            "clf",
            LogisticRegression(
                C=1.2,
                max_iter=250,
                solver="lbfgs",
                tol=1e-3,
                random_state=42,
            ),
        ),
    ])

    print("Training Logistic Regression model on text features (title + description)...", flush=True)
    train_start = time.time()
    pipeline.fit(X_train, y_train)
    train_time = time.time() - train_start
    print(f"Model trained in {train_time:.2f} seconds!", flush=True)

    print("Evaluating model performance on test set...", flush=True)
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Test Accuracy: {accuracy * 100:.2f}%", flush=True)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, digits=3), flush=True)

    # Attach MEHRAÉ boutique helper attributes directly on pipeline
    classes = list(pipeline.classes_)
    pipeline.mehrae_category_map = MEHRAE_CATEGORY_MAP
    pipeline.classes_list = classes

    print(f"Saving model to {MODEL_OUTPUT_FILE}...", flush=True)
    joblib.dump(pipeline, MODEL_OUTPUT_FILE)
    file_size_mb = os.path.getsize(MODEL_OUTPUT_FILE) / (1024 * 1024)
    print(f"Model successfully saved to '{MODEL_OUTPUT_FILE}' ({file_size_mb:.2f} MB)", flush=True)

    # Also save metadata json for lightweight inspectability
    meta = {
        "model_file": MODEL_OUTPUT_FILE,
        "classes": classes,
        "category_mapping": MEHRAE_CATEGORY_MAP,
        "accuracy": float(accuracy),
        "trained_samples": len(df),
        "features": "TF-IDF (15,000 features, n-grams 1-2, sublinear tf)",
        "classifier": "LogisticRegression(C=1.2, solver='lbfgs')",
    }
    with open(META_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Metadata exported to '{META_OUTPUT_FILE}'", flush=True)

    # Test sample search predictions
    test_queries = [
        "pure mulberry silk saree with zari border",
        "red bridal lehenga choli with zardozi embroidery",
        "chanderi anarkali kurta set for sangeet",
        "uncut polki choker necklace and emerald jhumkas",
        "casual summer t-shirt",
        "formal blazer jacket",
    ]
    print("\n--- Model Verification & Sample Inferences ---", flush=True)
    for q in test_queries:
        pred_sub = pipeline.predict([q])[0]
        probs = pipeline.predict_proba([q])[0]
        conf = float(np.max(probs))
        mehrae_cat = MEHRAE_CATEGORY_MAP.get(pred_sub, "dresses")
        print(f"Query: '{q}' -> Predicted: {pred_sub} ({conf*100:.1f}%) => MEHRAÉ Category: '{mehrae_cat}'", flush=True)

if __name__ == "__main__":
    train()
