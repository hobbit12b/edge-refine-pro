import { GoogleGenerativeAI } from "@google/generative-ai";
import { Frame } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface AnimationInsight {
  type: string;
  description: string;
  tags: string[];
  vibe: string;
  optimizationTips: string[];
}

export interface SmartBackgroundResult {
  chromaColor: string;
  tolerance: number;
  subjectBox: { x: number, y: number, w: number, h: number };
  backgroundSeeds: { x: number, y: number }[];
  edgeRefinement: { erosion: number, blur: number };
  technique: 'chroma' | 'mask' | 'auto';
  reasoning: string;
}

export async function detectSubject(frame: Frame): Promise<SmartBackgroundResult> {
  const prompt = `You are a pro background removal AI (like remove.bg). 
  Analyze this game sprite frame and provide exact coordinates for perfect extraction.
  
  1. Identifity the core background color (hex).
  2. Provide a normalized bounding box [ymin, xmin, ymax, xmax] for the PRIMARY subject (0-1000 scale).
  3. Provide 5-10 "backgroundSeeds" (x, y coordinates from 0-1000) that are definitely background pixels.
  4. Suggest edge refinement: "erosion" (0-5) and "blur" (0-5).
  5. Best tolerance (0-200).

  Return ONLY a JSON object:
  {
    "chromaColor": "#RRGGBB",
    "tolerance": number,
    "subjectBox": { "x": number, "y": number, "w": number, "h": number },
    "backgroundSeeds": [{ "x": number, "y": number }],
    "edgeRefinement": { "erosion": number, "blur": number },
    "technique": "chroma",
    "reasoning": "explanation"
  }`;

  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
    });
    reader.readAsDataURL(frame.blob);
    const base64 = await base64Promise;
    const data = base64.split(",")[1];

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data,
          mimeType: "image/png"
        }
      }
    ]);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    
    // Ensure the structure is correct even if AI leaves out fields or sub-fields
    const edgeRef = parsed.edgeRefinement || {};
    
    return {
      chromaColor: parsed.chromaColor || "#000000",
      tolerance: parsed.tolerance ?? 30,
      subjectBox: parsed.subjectBox || { x: 0, y: 0, w: 1000, h: 1000 },
      backgroundSeeds: parsed.backgroundSeeds || [],
      edgeRefinement: {
        erosion: typeof edgeRef.erosion === 'number' ? edgeRef.erosion : 0,
        blur: typeof edgeRef.blur === 'number' ? edgeRef.blur : 0
      },
      technique: parsed.technique || 'chroma',
      reasoning: parsed.reasoning || ""
    };
  } catch (error) {
    console.error("Gemini Detection failed:", error);
    return {
      chromaColor: "#000000",
      tolerance: 30,
      subjectBox: { x: 0, y: 0, w: 1000, h: 1000 },
      backgroundSeeds: [],
      edgeRefinement: { erosion: 0, blur: 0 },
      technique: 'chroma',
      reasoning: "Detection failed, falling back to defaults."
    };
  }
}

export async function analyzeAnimation(frames: Frame[]): Promise<AnimationInsight> {
  // We don't want to send ALL frames if there are hundreds. 
  // Pick up to 8 representative frames.
  const step = Math.max(1, Math.floor(frames.length / 8));
  const selectedFrames = [];
  for (let i = 0; i < frames.length; i += step) {
    if (selectedFrames.length < 8) {
      selectedFrames.push(frames[i]);
    }
  }

  const prompt = `Analyze this sequence of animation frames for a game sprite. 
  1. What type of animation is this? (e.g. Idle, Run, Jump, Attack, Death)
  2. Describe the motion and fluidness.
  3. Suggest 5 relevant tags for a game engine asset store.
  4. What is the emotional "vibe" of the movement?
  5. Provide 2-3 specific technical tips to optimize this specific animation for a 2D game engine like Phaser or Unity.

  Return ONLY a JSON object with the following structure:
  {
    "type": "string",
    "description": "string",
    "tags": ["string", "string", ...],
    "vibe": "string",
    "optimizationTips": ["string", "string", ...]
  }`;

  try {
    const parts = await Promise.all(selectedFrames.map(async (frame) => {
      // We need to fetch the blob data as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(frame.blob);
      const base64 = await base64Promise;
      const data = base64.split(",")[1];
      return {
        inlineData: {
          data,
          mimeType: "image/png"
        }
      };
    }));

    const result = await model.generateContent([prompt, ...parts]);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON if needed (sometimes Gemini wraps it in markdown)
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis failed:", error);
    return {
      type: "Unknown",
      description: "Analysis unavailable.",
      tags: ["sprite"],
      vibe: "Static",
      optimizationTips: ["Check API connection"]
    };
  }
}
