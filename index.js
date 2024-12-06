import express from 'express';
import multer from 'multer';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

async function retryWithBackoff(fn, maxAttempts = 5, baseDelayMs = 1000) {
  let attempt = 1;

  return new Promise((resolve, reject) => {
    const execute = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        if (attempt === maxAttempts) {
          reject(error);
        } else {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.warn(`Retrying request (attempt ${attempt}/${maxAttempts}) after ${delay}ms`);
          attempt++;
          setTimeout(execute, delay);
        }
      }
    };

    execute();
  });
}

async function processImage(imagePath) {
  function fileToGenerativePart(path, mimeType) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(path)).toString("base64"),
        mimeType,
      },
    };
  }

  const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });
  const prompt = `
    Analyze the provided image of a tablet. Extract and present the following information in a clear and concise format:

    **Tablet Name:**
    **Purpose:**
    **When to Take:** (Morning, Afternoon, Night)
    **Before/After Meal:** (Before Meal, After Meal, N/A)

    If the image is not related to a tablet, simply state "Image not related to a tablet."
  `;
  const imageParts = [fileToGenerativePart(imagePath, "image/jpeg")];

  const result = await retryWithBackoff(async () => {
    return await model.generateContent([prompt, ...imageParts]);
  });

  const response = await result.response;
  const text = response.text();
  return text;
}

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const result = await processImage(imagePath);
    res.json(result );
     console.log(result);
     
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});