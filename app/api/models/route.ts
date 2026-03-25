import { NextResponse } from "next/server";
import { getRecommendedModels } from "@/lib/session-service";

export async function GET() {
  return NextResponse.json(getRecommendedModels());
}
