import { handleRoute } from "@/lib/errors";
import { getOpenApiSpec } from "@/services/openapi/openapi-service";

export async function GET() {
  return handleRoute(() => getOpenApiSpec());
}
