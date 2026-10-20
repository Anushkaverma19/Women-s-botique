import os
import sys
import json
import argparse
import re

OCCASION_KEYWORDS = {
    "bridal": ["bridal", "bride", "wedding", "shaadi", "trousseau", "zardozi", "dabka", "sindoor"],
    "festive": ["festive", "diwali", "pooja", "navratri", "garba", "temple", "haldi", "mehendi", "sangeet"],
    "cocktail": ["cocktail", "reception", "party", "evening", "glam", "contemporary", "indo-western"],
    "everyday-luxury": ["workwear", "office", "minimal", "cotton", "casual", "everyday", "summer"],
}

STYLE_TAGS = [
    "silk", "zari", "kundan", "polki", "pearl", "velvet",
    "organza", "chanderi", "brocade", "handloom", "embroidered"
]

CATEGORY_PATTERNS = [
    ("sarees", "Sarees", [r"saree", r"sari", r"pallu", r"kanjivaram", r"banarasi", r"organza saree", r"drape"]),
    ("lehengas", "Lehengas", [r"lehenga", r"choli", r"ghagra", r"bridal lehenga", r"kalidar", r"can-can"]),
    ("jewellery", "Jewellery", [r"jewel", r"necklace", r"choker", r"jhumka", r"earring", r"bangle", r"polki", r"kundan", r"matha patti"]),
    ("dresses", "Dresses & Kurtas", [r"dress", r"gown", r"wrap dress", r"kurta", r"anarkali", r"sharara", r"suit", r"kaftan", r"one-shoulder"]),
]

def detect_category(text: str) -> tuple[str, str, float]:
    norm = text.lower()
    for cat_slug, sub_cat, patterns in CATEGORY_PATTERNS:
        for p in patterns:
            if re.search(r"\b" + p + r"\b", norm):
                return cat_slug, sub_cat, 0.92

    for cat_slug, sub_cat, patterns in CATEGORY_PATTERNS:
        for p in patterns:
            if p in norm:
                return cat_slug, sub_cat, 0.85

    return "dresses", "Dresses & Kurtas", 0.70

def detect_occasion(text: str) -> str:
    norm = text.lower()
    for occ, kws in OCCASION_KEYWORDS.items():
        if any(kw in norm for kw in kws):
            return occ
    return "festive"

def extract_keywords(text: str) -> list[str]:
    norm = text.lower()
    return [kw for kw in STYLE_TAGS if kw in norm]

def predict_intent(query: str = "", history: list[str] = None) -> dict:
    """
    Predicts MEHRAÉ fashion search and browsing intent across catalogue categories,
    occasions, and style keywords.
    """
    combined_query = (query or "").strip()
    history = history or []

    target_text = combined_query
    if not target_text and history:
        target_text = " ".join(history)

    if not target_text:
        return {
            "predicted_sub_category": "Dresses & Kurtas",
            "matched_category": "dresses",
            "confidence": 0.5,
            "top_intents": [],
            "occasion": "festive",
            "keywords": [],
            "browsing_affinity": {},
        }

    matched_cat, sub_cat, confidence = detect_category(target_text)
    occasion = detect_occasion(target_text)
    keywords = extract_keywords(target_text)

    # Compute browsing affinity across history
    browsing_affinity = {}
    if history:
        for item in history:
            c, _, _ = detect_category(item)
            browsing_affinity[c] = browsing_affinity.get(c, 0) + 1
        total = max(1, len(history))
        browsing_affinity = {k: round(v / total, 2) for k, v in browsing_affinity.items()}
    else:
        browsing_affinity = {matched_cat: 1.0}

    top_intents = [
        {"sub_category": sub_cat, "mehrae_category": matched_cat, "confidence": confidence}
    ]

    return {
        "predicted_sub_category": sub_cat,
        "matched_category": matched_cat,
        "confidence": confidence,
        "top_intents": top_intents,
        "occasion": occasion,
        "keywords": keywords,
        "browsing_affinity": browsing_affinity,
    }

def main():
    parser = argparse.ArgumentParser(description="MEHRAÉ Fashion Intent Prediction Bridge")
    parser.add_argument("--query", type=str, default="", help="User search query")
    parser.add_argument("--history", type=str, default="", help="Comma-separated browsing history")
    parser.add_argument("--json", action="store_true", help="Read input from stdin JSON")
    parser.add_argument("--serve", action="store_true", help="Run HTTP microservice daemon")
    parser.add_argument("--port", type=int, default=5005, help="Microservice port")

    args = parser.parse_args()

    if args.serve:
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
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "feature": "MEHRAÉ Fashion Intent Prediction"
                }).encode("utf-8"))

            def log_message(self, format, *args):
                pass

        server_addr = ("127.0.0.1", args.port)
        httpd = HTTPServer(server_addr, IntentHandler)
        print(f"MEHRAÉ Fashion Intent microservice running on http://127.0.0.1:{args.port}", flush=True)
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
