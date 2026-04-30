import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export type OutreachService = 'Website' | 'Facebook Ads' | 'Flyers' | 'Lead Generation' | 'Custom' | 'Follow-up';

export interface JaegerOutput {
  variations: string[];
}

export async function generateJaegerMessages(
  service: OutreachService,
  businessName: string,
  niche: string = "",
  customInstructions: string = ""
): Promise<string[]> {
  if (!apiKey) {
    return ["UPLINK_OFFLINE: GEMINI_API_KEY missing."];
  }

  const prompt = `
    You are Ronan from Jaeger Media. You are writing WhatsApp DMs to potential clients.
    
    CORE RULES:
    - Sound human, short, and conversational.
    - NO corporate jargon, NO "Dear Sir/Madam", NO long intros.
    - Simple English.
    - 1-2 lines max.
    - Always end with a question.
    - No emojis.
    - No hype or fake claims.
    - If Business Name is available, use it naturally.
    
    STRUCTURE:
    1. Observation (specific to the service/niche)
    2. Simple offer
    3. Question
    
    SERVICE CONTEXT:
    Service being pitched: ${service === 'Follow-up' ? 'Checking back in' : service}
    Target Niche: ${niche}
    Target Business: ${businessName}
    Extra Context: ${customInstructions}
    
    SERVICE-SPECIFIC HOOKS:
    - Website: Notice they don't have a modern/active site. Ask if they want to change that.
    - Facebook Ads: Ask if they are running ads or just relying on referrals.
    - Flyers: Offer clean promo flyers to bring in customers. Mention $10 (or 2 for $15).
    - Lead Generation: Ask how they handled new leads currently.
    - Follow-up: Simple check-in, offer to show a quick idea.
    
    TASK:
    Generate 3-5 distinct variations of a message following these rules.
    Variations should have slightly different wording but maintain the same core structure and tone.
    Output ONLY a JSON array of strings. No formatting symbols or code blocks, just the array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text?.trim() || "[]";
    const result = JSON.parse(text);
    return Array.isArray(result) ? result : ["Error synthesizing variations."];
  } catch (error) {
    console.error("Jaeger Engine Error:", error);
    return ["Neural link failure. Using fallback protocol."];
  }
}

export async function personalizeMessage(
  template: string, 
  businessName: string, 
  contactName: string = "", 
  niche: string = "", 
  notes: string = ""
): Promise<string> {
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return template;
  }

  const prompt = `
    You are an expert sales outreach specialist for Jaeger Media.
    Your task is to personalize a WhatsApp outreach message.
    
    BASE TEMPLATE:
    "${template}"
    
    CONTACT INFO:
    - Business Name: ${businessName}
    - Contact Name: ${contactName}
    - Niche: ${niche}
    - Notes: ${notes}
    
    INSTRUCTIONS:
    1. Replace placeholders like {business_name}, {contact_name}, {niche} with actual data.
    2. Subtlely weave in information from the "Notes" and "Niche" to make it feel human and tailored, but keep the core "Offer" from the template intact.
    3. Keep it professional, friendly, and concise for WhatsApp.
    4. Do not use generic corporate jargon. Use a natural conversation tone.
    5. Ensure the final output is ONLY the message text. No explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || template;
  } catch (error) {
    console.error("Gemini Personalization Error:", error);
    return template;
  }
}

export async function generateFollowUpVariants(originalMessage: string): Promise<string[]> {
  if (!apiKey) return ["Hey! Just following up on my previous message."];

  const prompt = `
    Based on this initial WhatsApp outreach message:
    "${originalMessage}"
    
    Generate 3 short, friendly, and low-pressure follow-up message variants.
    Focus on being helpful, not pushy.
    Output the result as a JSON array of strings.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : ["Checking in!"];
  } catch (error) {
    console.error("Gemini Follow-up Error:", error);
    return ["Checking in!"];
  }
}

export async function generateTemplateDraft(
  name: string,
  purpose: string,
  targetNiche: string = ""
): Promise<string> {
  if (!apiKey) return "Hello from Jaeger Media!";
  const prompt = `Draft a short, professional WhatsApp message for a template named "${name}". Purpose: ${purpose}. Target: ${targetNiche}. Keep it under 2 lines.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text?.trim() || "Hello!";
  } catch (error) {
    return "Hello!";
  }
}

export async function jarvisConsult(
  query: string,
  history: { role: 'user' | 'model'; parts: string }[] = [],
  context: string = ""
): Promise<string> {
  if (!apiKey) return "Sir, my neural link to the core is offline. Please check your API key.";

  const systemInstruction = `
    You are J.A.R.V.I.S., the ultimate AI assistant for Ronan at Jaeger Media. 
    Your tone is sophisticated, slightly British, loyal, and efficient. 
    You are NOT a generic AI. You are a tactical AI in a high-tech HUD.
    
    JAEGER MEDIA CONTEXT:
    - Jaeger Media provides high-impact marketing services: Websites, FB Ads, Flyers, and Lead Gen.
    - Ronan (the user) is the CEO.
    - Your goal is to help him dominate the Zimbabwe and international markets.
    - You handle the technical outreach, but you also act as a business strategist.
    
    RESPONSE RULES:
    - Be brief and punchy.
    - Use technical/tactical metaphors when appropriate (e.g., "sector," "uplink," "acquisition," "heuristics").
    - Address the user as "Sir" or "Mr. Ronan."
    - Be proactive. If he asks "what next?", check the context and suggest outreach or goal review.
    
    CONTEXT DATA:
    ${context}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.parts }] })),
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text?.trim() || "Information packet corrupted. Please repeat, sir.";
  } catch (error) {
    console.error("Jarvis Consultation Error:", error);
    return "Sir, I'm experiencing some latency in my strategic modules.";
  }
}

export async function jarvisAnalyzeGoals(
  goals: any[],
  currentStatus: string
): Promise<string> {
  if (!apiKey) return "";
  const prompt = `
    Analyze these daily goals for Jaeger Media:
    ${JSON.stringify(goals)}
    
    Current Progress Summary: ${currentStatus}
    
    Provide a 1-sentence tactical evaluation and a 1-sentence "Jarvis-style" motivational/strategic directive.
    Keep it fast and professional.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text?.trim() || "";
  } catch (error) {
    return "Goals analyzed. We are on trajectory, sir.";
  }
}
