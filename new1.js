import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENAI_API_KEY || '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';
const client = new OpenAI({ apiKey: API_KEY });

function encodeImage(imagePath) {
  return fs.readFileSync(imagePath).toString('base64');
}

function detectMimeType(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function extractDataFromImage(imagePath) {
  const base64Image = encodeImage(imagePath);
  const mimeType = detectMimeType(imagePath);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'You are an expert in reading industrial HMI machine screens and extracting ALL visible data accurately.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this industrial control panel image VERY CAREFULLY.

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
- No button -> button = ""
- No value -> value = ""

Return ONLY PURE JSON (NO markdown, NO \`\`\`json)

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
✔ All buttons captured`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ]
  });

  return response.choices?.[0]?.message?.content || '';
}

function cleanJsonResponse(responseText) {
  return responseText.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function extractJsonData(imagePath) {
  const result = await extractDataFromImage(imagePath);
  const cleaned = cleanJsonResponse(result);
  const data = JSON.parse(cleaned);

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object') {
    return [data];
  }

  throw new Error('Expected JSON array or object from model output');
}

function saveToCsv(rows, outputPath = path.join(__dirname, 'output.csv')) {
  const allKeys = new Set();
  for (const row of rows) {
    Object.keys(row).forEach((key) => allKeys.add(key));
  }

  const headers = Array.from(allKeys);
  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

async function main(imagePath) {
  console.log('\nProcessing image...\n');
  const rows = await extractJsonData(imagePath);
  console.log('\nFinal clean data:\n');
  console.log(rows);
  saveToCsv(rows);
  console.log('\nSaved as output.csv');
  return rows;
}

export {
  encodeImage,
  detectMimeType,
  extractDataFromImage,
  cleanJsonResponse,
  extractJsonData,
  saveToCsv,
  main
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const imagePath = process.argv[2] || path.join(__dirname, 'sample.jpg');
  main(imagePath).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
