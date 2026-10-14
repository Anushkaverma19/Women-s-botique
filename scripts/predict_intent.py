import os
import sys
import json
import argparse
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mehrae_search_model.pkl")
if not os.path.exists(MODEL_PATH):
    # Fallback to local directory if run from root
    MODEL_PATH = "mehrae_search_model.pkl"

OCCASION_KEYWORDS = {
    "bridal": ["bridal", "bride", "wedding", "shaadi", "trousseau", "zardozi", "dabka", "sindoor"],
    "festive": ["festive", "diwali", "pooja", "navratri", "garba", "temple", "haldi", "mehendi", "sangeet"],
    "cocktail": ["cocktail", "reception", "party", "evening", "glam", "contemporary", "indo-western"],
    "everyday-luxury": ["workwear", "office", "minimal", "cotton", "casual", "everyday", "summer"],
}

STYLE_TAGS = ["silk", "zari", "kundan", "polki", "pearl", "velvet", "organza", "chanderi", "brocade", "handloom", "embroidered"]

_loaded_pipeline = None

def get_model():
    global _loaded_pipeline
    if _loaded_pipeline is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Run 'python train_model.py' first.")
        _loaded_pipeline = joblib.load(MODEL_PATH)
    return _loaded_pipeline

def detect_occasion(text: str) -> str:
    text_lower = text.lower()
    for occ, kws in OCCASION_KEYWORDS.items():
        if any(kw in text_lower for kw in kws):
            return occ
    return "festive"

def extract_keywords(text: str) -> list[str]:
    text_lower = text.lower()
    return [kw for kw in STYLE_TAGS if kw in text_lower]

def predict_intent(query: str = "", history: list[str] = None) -> dict:
    model = get_model()
    category_map = getattr(model, "mehrae_category_map", {
        "Sarees": "sarees",
        "Fabrics": "sarees",
        "Lehengas": "lehengas",
        "Kurtas, Ethnic Sets and Bottoms": "dresses",
        "Dresses": "dresses",
        "Topwear": "dresses",
        "Bottomwear": "dresses",
        "Winter Wear": "dresses",
        "Blazers, Waistcoats and Suits": "dresses",
        "Clothing Accessories": "jewellery",
        "Jewellery": "jewellery",
        "Bags, Wallets & Belts": "jewellery",
    })

    combined_query = (query or "").strip()
    history = history or []

    # If query is empty but history exists, construct pseudo-query from history
    target_text = combined_query
    if not target_text and history:
        target_text = " ".join(history)

    if not target_text:
        return {
            "predicted_sub_category": "Dresses",
            "matched_category": "dresses",
            "confidence": 0.5,
            "top_intents": [],
            "occasion": "festive",
            "keywords": [],
            "browsing_affinity": {},
        }

    probs = model.predict_proba([target_text])[0]
    classes = list(model.classes_)
    
    top_indices = np.argsort(probs)[::-1][:4]
    top_intents = []
    for idx in top_indices:
        sub = classes[idx]
        conf = float(probs[idx])
        mehrae_cat = category_map.get(sub, "dresses")
        top_intents.append({
            "sub_category": sub,
            "mehrae_category": mehrae_cat,
            "confidence": round(conf, 4)
        })

    best_sub = top_intents[0]["sub_category"]
    best_conf = top_intents[0]["confidence"]
    matched_cat = top_intents[0]["mehrae_category"]

    # Calculate browsing affinity if history provided
    browsing_affinity = {}
    if history:
        for item in history:
            item_probs = model.predict_proba([item])[0]
            item_top_idx = int(np.argmax(item_probs))
            item_sub = classes[item_top_idx]
            item_cat = category_map.get(item_sub, "dresses")
            browsing_affinity[item_cat] = browsing_affinity.get(item_cat, 0) + 1
        total_items = max(1, len(history))
        browsing_affinity = {k: round(v / total_items, 2) for k, v in browsing_affinity.items()}

    occasion = detect_occasion(target_text)
    keywords = extract_keywords(target_text)

    return {
        "predicted_sub_category": best_sub,
        "matched_category": matched_cat,
        "confidence": round(best_conf, 4),
        "top_intents": top_intents,
        "occasion": occasion,
        "keywords": keywords,
        "browsing_affinity": browsing_affinity,
    }

def main():
    parser = argparse.ArgumentParser(description="MEHRAÉ Model Inference Bridge")
    parser.add_argument("--query", type=str, default="", help="User search query")
    parser.add_argument("--history", type=str, default="", help="Comma-separated browsing history")
    parser.add_argument("--json", action="store_true", help="Read input from stdin JSON")
    parser.add_argument("--serve", action="store_true", help="Run HTTP microservice daemon")
    parser.add_argument("--port", type=int, default=5005, help="Microservice port")

    args = parser.parse_args()

    if args.serve:
        # Microservice daemon mode using Python built-in http.server
        from http.server import HTTPServer, BaseHTTPRequestHandler
        
        class IntentHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                content_len = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(content_len).decode("utf-8")
                try:
                    payload = json.loads(post_body) if post_body else {}
                    query = payload.get("query", "")
                    history = payload.get("history", [])
                    result = predict_intent(query, history)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode("utf-8"))
                except Exception as e:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

            def do_GET(self):
                # Health check
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "model": "mehrae_search_model.pkl"}).encode("utf-8"))

            def log_message(self, format, *args):
                pass # suppress stdout logs for quiet daemon operation

        server_addr = ("127.0.0.1", args.port)
        httpd = HTTPServer(server_addr, IntentHandler)
        print(f"MEHRAÉ Intent Microservice running on http://127.0.0.1:{args.port}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
        return

    if args.json:
        stdin_data = sys.stdin.read().strip()
        payload = json.loads(stdin_data) if stdin_data else {}
        query = payload.get("query", "")
        history = payload.get("history", [])
    else:
        query = args.query
        history = [h.strip() for h in args.history.split(",") if h.strip()] if args.history else []

    result = predict_intent(query, history)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
