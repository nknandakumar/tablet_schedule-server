import dotenv from "dotenv";
import * as fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

async function run() {
  const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });
  const prompt = `
  Analyze the provided image of a tablet. Extract and present the following information in a clear and concise format:

  **Tablet Name:**
  **Purpose:**
  **When to Take:** (Morning, Afternoon, Night)
  **Before/After Meal:** (Before Meal, After Meal, N/A)

  If the image is not related to a tablet, simply state "Image not related to a tablet."
  `;
  const imageParts = [fileToGenerativePart("tablet1.jpg", "image/jpeg")];

  async function retryWithBackoff(func, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await func();
      } catch (error) {
        if (error.message.includes("Too Many Requests")) {
          console.warn(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }
    throw new Error("Max retries exceeded");
  }

  const result = await retryWithBackoff(async () => {
    return await model.generateContent([prompt, ...imageParts]);
  });

  const response = await result.response;
  const text = response.text();
  console.log(text);
}

run();
//For why this tablet and tell when it to take means (morning,afternoon,night) and before are after meal. the details want in table form and the image is not about tablet give response and the image is not belongs to tablet 