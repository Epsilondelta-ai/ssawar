import { getModelById, getProviderModelName } from "@/lib/models";

type GenerateTextInput = {
  modelId: string;
  prompt: string;
  system?: string;
};

function getVendorApiKey(vendor: "openai" | "anthropic" | "google" | "mock") {
  if (vendor === "openai") return process.env.OPENAI_API_KEY;
  if (vendor === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (vendor === "google") return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return undefined;
}

function extractOpenAIText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const output = (payload as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const text = output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("").trim();
  return text || null;
}

function extractAnthropicText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as { content?: Array<{ text?: string }> }).content;
  const text = content?.map((item) => item.text ?? "").join("").trim();
  return text || null;
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const text = candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  return text || null;
}

async function generateWithOpenAI({ modelId, prompt, system }: GenerateTextInput) {
  const apiKey = getVendorApiKey("openai");
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getProviderModelName(modelId),
      input: system ? `${system}\n\n${prompt}` : prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`OPENAI_${response.status}`);
  }

  return extractOpenAIText(await response.json());
}

async function generateWithAnthropic({ modelId, prompt, system }: GenerateTextInput) {
  const apiKey = getVendorApiKey("anthropic");
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getProviderModelName(modelId),
      max_tokens: 300,
      system,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`ANTHROPIC_${response.status}`);
  }

  return extractAnthropicText(await response.json());
}

async function generateWithGemini({ modelId, prompt, system }: GenerateTextInput) {
  const apiKey = getVendorApiKey("google");
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getProviderModelName(modelId)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: system
          ? {
              parts: [{ text: system }],
            }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`GEMINI_${response.status}`);
  }

  return extractGeminiText(await response.json());
}

export async function generateModelText(input: GenerateTextInput) {
  const model = getModelById(input.modelId);
  if (!model || model.vendor === "mock") {
    return null;
  }

  if (model.vendor === "openai") {
    return generateWithOpenAI(input);
  }

  if (model.vendor === "anthropic") {
    return generateWithAnthropic(input);
  }

  if (model.vendor === "google") {
    return generateWithGemini(input);
  }

  return null;
}

export function providerAvailability() {
  return {
    openai: Boolean(getVendorApiKey("openai")),
    anthropic: Boolean(getVendorApiKey("anthropic")),
    google: Boolean(getVendorApiKey("google")),
  };
}
