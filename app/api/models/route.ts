import { NextResponse } from "next/server";
import { getRecommendedModels } from "@/lib/session-service";
import { providerAvailability } from "@/lib/llm-providers";

export async function GET() {
  return NextResponse.json({
    ...getRecommendedModels(),
    providers: providerAvailability(),
  });
}
