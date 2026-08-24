import { Resend } from "resend";

const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT = 5;
const requestLog = new Map<string, number[]>();

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function clientIp(req: Request) {
  return clean(req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter((timestamp) => now - timestamp < REQUEST_WINDOW_MS);
  if (recent.length >= REQUEST_LIMIT) {
    requestLog.set(ip, recent);
    return true;
  }
  requestLog.set(ip, [...recent, now]);
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (clean(body.website, 200)) {
      return Response.json({ ok: true });
    }

    if (isRateLimited(clientIp(req))) {
      return Response.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const name = clean(body.name, 100);
    const org = clean(body.org, 150);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 50);
    const field = clean(body.field, 100);
    const department = clean(body.department, 100);
    const inquiryType = clean(body.inquiryType, 100);
    const product = clean(body.product, 300);
    const message = clean(body.message, 5000);
    const sourceUrl = clean(body.sourceUrl, 1000);
    const privacyAccepted = body.privacyAccepted === true;

    if (!validEmail(email) || !message || !privacyAccepted) {
      return Response.json({ ok: false, error: "A valid email, message, and privacy agreement are required." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.QUOTE_TO_EMAIL;

    if (!apiKey) {
      console.error("Quote email is not configured: RESEND_API_KEY is missing.");
      return Response.json({ ok: false, error: "The message service is temporarily unavailable." }, { status: 503 });
    }
    if (!toEmail) {
      console.error("Quote email is not configured: QUOTE_TO_EMAIL is missing.");
      return Response.json({ ok: false, error: "The message service is temporarily unavailable." }, { status: 503 });
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: process.env.QUOTE_FROM_EMAIL || "ITS BIO <onboarding@resend.dev>",
      to: [toEmail],
      subject: `[${inquiryType || "Quote Request"}] ${product || "General inquiry"} - ${name || "Unknown"}`,
      text: `
New website inquiry received:

Name: ${name}
Org: ${org}
Email: ${email}
Phone: ${phone}
Field: ${field}
Department: ${department}
Inquiry type: ${inquiryType}
Product/CatNo: ${product}
${sourceUrl ? `Source page: ${sourceUrl}\n` : ""}
Message:
${message}
      `.trim(),
      replyTo: email,
    });

    if (error) {
      console.error("Resend failed:", error.message);
      return Response.json({ ok: false, error: "We could not send your message. Please email info@itsbio.co.kr." }, { status: 502 });
    }

    return Response.json({ ok: true, id: data?.id });
  } catch (error) {
    console.error("Quote request failed:", error);
    return Response.json({ ok: false, error: "We could not process your message." }, { status: 500 });
  }
}
