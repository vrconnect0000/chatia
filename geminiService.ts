
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { Message } from "./types";

const MODEL_NAME = 'gemini-3-flash-preview';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  async *streamChat(history: Message[], userInput: string, useSearch: boolean) {
    // Transform our internal message format to Gemini's expected history
    // Note: Gemini Chat session handles history automatically if we use ai.chats.create
    const chat = this.ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: "You are a helpful, brilliant, and professional AI assistant. Provide concise yet comprehensive answers. Format your output with Markdown.",
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
      },
    });

    // Send previous messages to initialize context if needed (though chats.create typically starts fresh)
    // For a stateless-feeling stream, we use sendMessageStream
    try {
      const responseStream = await chat.sendMessageStream({ message: userInput });
      
      let fullText = "";
      let groundingMetadata: any = null;

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        const text = c.text || "";
        fullText += text;
        
        if (c.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = c.candidates[0].groundingMetadata;
        }

        yield {
          text: fullText,
          done: false,
          groundingMetadata
        };
      }

      yield {
        text: fullText,
        done: true,
        groundingMetadata
      };
    } catch (error: any) {
      console.error("Gemini stream error:", error);
      throw error;
    }
  }
}

export const gemini = new GeminiService();
