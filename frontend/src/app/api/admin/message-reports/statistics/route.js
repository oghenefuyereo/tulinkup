import {
  proxyMessageReport,
} from "@/lib/adminMessageReportProxy";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return proxyMessageReport(request, "statistics");
}
