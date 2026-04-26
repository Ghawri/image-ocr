import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractJsonData } from './new1.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });
const PORT = process.env.PORT || 8000;

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

app.use(express.static(__dirname));

app.post('/extract', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    const rows = await extractJsonData(req.file.path);
    return res.json({ rows });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to process image',
      details: error.message
    });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
