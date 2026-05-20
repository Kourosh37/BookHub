import { getOpenApiSpec } from "@/services/openapi/openapi-service";

export async function GET() {
  return getOpenApiSpec();
}
