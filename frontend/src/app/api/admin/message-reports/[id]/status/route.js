import {
  proxyMessageReport,
} from "@/lib/adminMessageReportProxy";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  return proxyMessageReport(
    request,
    "decision",
    params
  );
}
