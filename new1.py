import openai
import base64
import json
import pandas as pd

# 🔑 SET YOUR NEW API KEY
openai.api_key = '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'


# -----------------------------
# STEP 1: ENCODE IMAGE
# -----------------------------
def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


# -----------------------------
# STEP 2: OPENAI VISION CALL
# -----------------------------
def extract_data_from_image(image_path):
    base64_image = encode_image(image_path)

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
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
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ]
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
    # image_path = r"C:\Users\ekarigar\Downloads\ocr_images\image.jpg"  # 👈 change path
    image_path = r"C:\Users\ekarigar\Downloads\ocr_images\1.jpeg"  # 👈 change path
    main(image_path)