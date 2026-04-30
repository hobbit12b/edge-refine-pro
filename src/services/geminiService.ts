import { supabase } from "@/integrations/supabase/client";
import { Frame } from "../types";

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
  subjectBox: { x: number; y: number; w: number; h: number };
  backgroundSeeds: { x: number; y: number }[];
  edgeRefinement: { erosion: number; blur: number };
  technique: "chroma" | "mask" | "auto";
  reasoning: string;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function detectSubject(frame: Frame): Promise<SmartBackgroundResult> {
  try {
    const dataUrl = await blobToDataUrl(frame.blob);
    const { data, error } = await supabase.functions.invoke("ai-detect", {
      body: { task: "detectSubject", imageBase64: dataUrl },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return {
      chromaColor: data.chromaColor || "#000000",
      tolerance: typeof data.tolerance === "number" ? data.tolerance : 15,
      subjectBox: data.subjectBox || { x: 0, y: 0, w: frame.originalWidth, h: frame.originalHeight },
      backgroundSeeds: [],
      edgeRefinement: {
        erosion: data.edgeRefinement?.erosion ?? 1,
        blur: data.edgeRefinement?.blur ?? 0,
      },
      technique: "chroma",
      reasoning: data.reasoning || "",
    };
  } catch (err) {
    console.error("detectSubject failed", err);
    return {
      chromaColor: "#000000",
      tolerance: 15,
      subjectBox: { x: 0, y: 0, w: frame.originalWidth, h: frame.originalHeight },
      backgroundSeeds: [],
      edgeRefinement: { erosion: 1, blur: 0 },
      technique: "chroma",
      reasoning: "Detection failed; using defaults.",
    };
  }
}

export async function analyzeAnimation(frames: Frame[]): Promise<AnimationInsight> {
  try {
    const step = Math.max(1, Math.floor(frames.length / 8));
    const selected: Frame[] = [];
    for (let i = 0; i < frames.length; i += step) {
      if (selected.length < 8) selected.push(frames[i]);
    }
    const imagesBase64 = await Promise.all(selected.map((f) => blobToDataUrl(f.blob)));
    const { data, error } = await supabase.functions.invoke("ai-detect", {
      body: { task: "analyzeAnimation", imagesBase64 },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (err) {
    console.error("analyzeAnimation failed", err);
    return {
      type: "Unknown",
      description: "Analysis unavailable.",
      tags: ["sprite"],
      vibe: "Static",
      optimizationTips: ["Check AI connection"],
    };
  }
}
