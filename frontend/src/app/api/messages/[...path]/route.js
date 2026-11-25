import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, private",
};

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: responseHeaders,
  });
}

// Allow only the implemented messaging endpoints.
const allowedRoutes = [
  {
    pattern: /^conversations\/[1-9]\d{0,18}\/messages\/[1-9]\d{0,18}\/report$/,
    methods: ["POST"],
  },
  {
    pattern: /^unread-count$/,
    methods: ["GET"],
  },
  {
    pattern: /^conversations$/,
    methods: ["GET", "POST"],
  },
  {
    pattern: /^conversations\/[1-9]\d{0,18}$/,
    methods: ["GET"],
  },
  {
    pattern: /^conversations\/[1-9]\d{0,18}\/messages$/,
    methods: ["GET", "POST"],
  },
  {
    pattern: /^conversations\/[1-9]\d{0,18}\/read$/,
    methods: ["PATCH"],
  },
  {
    pattern: /^conversations\/[1-9]\d{0,18}\/block$/,
    methods: ["POST", "DELETE"],
  },
];

async function proxyMessaging(request, context) {
  try {
    const { path } = await context.params;

    const endpoint = Array.isArray(path)
      ? path.join("/")
      : "";

    const route = allowedRoutes.find(
      item => item.pattern.test(endpoint)
    );

    if (!route) {
      return jsonResponse(
        {
          success: false,
          message: "Messaging endpoint not found.",
        },
        404
      );
    }

    if (!route.methods.includes(request.method)) {
      return jsonResponse(
        {
          success: false,
          message: "Method not allowed.",
        },
        405
      );
    }

    // Protect cookie-authenticated write requests.
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      const fetchSite = request.headers.get("sec-fetch-site");

      const expectedOrigin = new URL(
        process.env.APP_ORIGIN || request.url
      ).origin;

      if (
        origin !== expectedOrigin ||
        (fetchSite && fetchSite !== "same-origin")
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid request origin.",
          },
          403
        );
      }
    }

    const cookieStore = await cookies();

    const token = cookieStore.get(
      "tulinkup_token"
    )?.value;

    if (!token) {
      return jsonResponse(
        {
          success: false,
          message: "Please log in to access messages.",
        },
        401
      );
    }

    const apiBase = (
      process.env.API_URL ||
      "http://localhost:5001"
    ).replace(/\/+$/, "");

    const backendUrl = new URL(
      `${apiBase}/api/messages/${endpoint}`
    );

    // Forward only supported pagination parameters.
    if (request.method === "GET") {
      const incoming = new URL(request.url);

      const allowedQuery =
        endpoint === "conversations"
          ? ["limit", "offset"]
          : endpoint.endsWith("/messages")
            ? ["limit", "beforeId"]
            : [];

      for (const key of allowedQuery) {
        const value = incoming.searchParams.get(key);

        if (value !== null) {
          backendUrl.searchParams.set(key, value);
        }
      }
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const options = {
      method: request.method,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    };

    const bodylessBlockOperation =
      endpoint.endsWith("/block") &&
      ["POST", "DELETE"].includes(request.method);

    if (
      request.method !== "GET" &&
      !bodylessBlockOperation
    ) {
      const contentType =
        request.headers.get("content-type") || "";

      if (
        contentType.split(";")[0].trim().toLowerCase()
          !== "application/json"
      ) {
        return jsonResponse(
          {
            success: false,
            message: "JSON request required.",
          },
          415
        );
      }

      // Limit incoming request size.
      const reader = request.body?.getReader();
      const chunks = [];
      let totalBytes = 0;

      if (!reader) {
        return jsonResponse(
          {
            success: false,
            message: "Request body required.",
          },
          400
        );
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > 65536) {
          await reader.cancel();

          return jsonResponse(
            {
              success: false,
              message: "Request body is too large.",
            },
            413
          );
        }

        chunks.push(Buffer.from(value));
      }

      let body;

      try {
        body = JSON.parse(
          Buffer.concat(chunks).toString("utf8")
        );
      } catch {
        return jsonResponse(
          {
            success: false,
            message: "Invalid JSON request.",
          },
          400
        );
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid request body.",
          },
          400
        );
      }

      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(
      backendUrl,
      options
    );

    if (response.status >= 500) {
      return jsonResponse(
        {
          success: false,
          message: "Messaging is temporarily unavailable.",
        },
        502
      );
    }

    const data = await response.json();

    return jsonResponse(data, response.status);

  } catch {
    // Never log private messages or authentication tokens.
    console.error("TuLinkUp messaging proxy failed.");

    return jsonResponse(
      {
        success: false,
        message: "Unable to complete messaging request.",
      },
      502
    );
  }
}

export async function GET(request, context) {
  return proxyMessaging(request, context);
}

export async function POST(request, context) {
  return proxyMessaging(request, context);
}

export async function PATCH(request, context) {
  return proxyMessaging(request, context);
}

export async function DELETE(request, context) {
  return proxyMessaging(request, context);
}
