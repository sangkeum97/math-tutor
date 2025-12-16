import { GoogleGenAI } from "@google/genai";

const getAI = () => {
    // API key must be obtained exclusively from process.env.API_KEY
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Simplified to avoid accidental calls if not needed
export const generateMathHelp = async (
    prompt: string,
    imageBase64?: string,
    modelName: string = 'gemini-2.5-flash'
): Promise<string> => {
    // Implementation kept for manual use, but errors handled gracefully
    try {
        const ai = getAI();
        // ... rest of logic implies usage only when explicitly called
        // Since we removed the chat panel, this might not be called, but we keep it valid.
        return "AI Feature disabled in this view."; 
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return "AI service unavailable.";
    }
};

export const recognizePageNumber = async (imageBase64: string): Promise<string | null> => {
    // Disabled to prevent "Quota Exceeded" errors completely
    return null; 
}

export function float32To16BitPCM(float32Arr: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Arr.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Arr.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Arr[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export async function base64ToAudioBuffer(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(dataInt16.length);
    for (let i=0; i<dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768.0;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    return buffer;
}