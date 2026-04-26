import base64
import json
import pandas as pd
import sys

try:
    from openai import OpenAI
    USE_OPENAI_V1 = True
except Exception:
    import openai
    USE_OPENAI_V1 = False

# 🔑 SET YOUR NEW API KEY
API_KEY = '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'

if USE_OPENAI_V1:
    client = OpenAI(api_key=API_KEY)
else:
    openai.api_key = API_KEY


# -----------------------------
# STEP 1: ENCODE IMAGE
# -----------------------------
def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def detect_mime_type(image_path):
    ext = image_path.lower().rsplit(".", 1)[-1] if "." in image_path else ""
    if ext == "png":
        return "image/png"
    if ext in ("jpg", "jpeg"):
        return "image/jpeg"
    if ext == "webp":
        return "image/webp"
    return "image/jpeg"


# -----------------------------
# STEP 2: OPENAI VISION CALL
# -----------------------------
def extract_data_from_image(image_path):
    base64_image = encode_image(image_path)
    mime_type = detect_mime_type(image_path)

    messages = [
        {
            "role": "system",
            "content": "You are an expert in reading industrial HMI machine screens and extracting ALL visible data accurately."
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": """
Analyze this industrial control panel image VERY CAREFULLY.

STRICT RULES:

1. Extract EVERY visible element.
2. Each UI block must be a separate entry.
3. DO NOT merge sections.
4. DO NOT skip ANY numbers, buttons, or labels.
5. DO NOT return duplicate entries.
6. Fix spelling mistakes if needed.

Extract:
- Labels (INLET, OUTLET, STROKE, etc.)
- Buttons (START, STOP, ON, OFF, UP, DOWN, AUTO)
- Numeric values (19.00, 45.00, 102, -21, etc.)

If:
- No button → button = ""
- No value → value = ""

Return ONLY PURE JSON (NO markdown, NO ```json)

FORMAT:
[
  {
    "label": "",
    "button": "",
    "value": ""
  }
]

DOUBLE CHECK:
✔ No missing values
✔ No duplicates
✔ All numbers captured
✔ All buttons captured
"""
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_image}"
                    }
                }
            ]
        }
    ]

    if USE_OPENAI_V1:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=messages,
    )
    return response['choices'][0]['message']['content']


# -----------------------------
# STEP 3: CLEAN JSON RESPONSE
# -----------------------------
def clean_json_response(response_text):
    if "```" in response_text:
        response_text = response_text.replace("```json", "")
        response_text = response_text.replace("```", "")
    return response_text.strip()


def extract_json_data(image_path):
    result = extract_data_from_image(image_path)
    cleaned = clean_json_response(result)
    data = json.loads(cleaned)

    if isinstance(data, dict):
        return [data]
    if not isinstance(data, list):
        raise ValueError("Expected JSON array or object from model output")

    return data


# -----------------------------
# STEP 4: SAVE TO CSV
# -----------------------------
def save_to_csv(json_data):
    try:
        cleaned = clean_json_response(json_data)

        data = json.loads(cleaned)

        # remove duplicates safely
        unique_data = [dict(t) for t in {tuple(d.items()) for d in data}]

        df = pd.DataFrame(unique_data)

        print("\n✅ FINAL CLEAN DATA:\n")
        print(df)

        df.to_csv("output.csv", index=False)
        print("\n💾 Saved as output.csv")

    except Exception as e:
        print("\n❌ ERROR PARSING JSON")
        print("\nRAW OUTPUT:\n", json_data)
        print("\nCLEANED OUTPUT:\n", cleaned)
        print("\nError:", str(e))


# -----------------------------
# MAIN FUNCTION
# -----------------------------
def main(image_path):
    print("\n🚀 Processing Image...\n")

    result = extract_data_from_image(image_path)

    print("\n🤖 RAW OUTPUT (preview):\n")
    print(result[:500])  # avoid full clutter

    save_to_csv(result)


# -----------------------------
# RUN SCRIPT
# -----------------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # Keep fallback path for local manual runs when no argument is passed.
        image_path = r"C:\Users\ekarigar\Downloads\ocr_images\1.jpeg"
    main(image_path)