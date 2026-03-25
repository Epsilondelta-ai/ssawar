export type SupportedModel = {
  id: string;
  label: string;
  vendor: "openai" | "anthropic" | "google" | "mock";
  kind: "orchestrator" | "participant" | "both";
};

export const SUPPORTED_MODELS: SupportedModel[] = [
  { id: "gpt-5.4", label: "GPT-5.4", vendor: "openai", kind: "both" },
  { id: "gpt-5.4-pro", label: "GPT-5.4 Pro", vendor: "openai", kind: "orchestrator" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", vendor: "anthropic", kind: "both" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", vendor: "anthropic", kind: "both" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vendor: "google", kind: "both" },
  { id: "mock-ringmaster", label: "Mock Ringmaster", vendor: "mock", kind: "orchestrator" },
];

export const DEFAULT_ORCHESTRATOR_MODEL = "claude-sonnet-4-5";

export const DEFAULT_PARTICIPANTS = [
  "gpt-5.4",
  "claude-opus-4-5",
  "gemini-2.5-pro",
];

export function getModelById(id: string) {
  return SUPPORTED_MODELS.find((model) => model.id === id);
}
