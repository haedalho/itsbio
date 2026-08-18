import { Resend } from "resend";

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeLabel(value: unknown) {
  const label = clean(value);
  if (/^item\s*#$/i.test(label)) return "Item #";
  if (/^cat\.?\s*no\.?$/i.test(label)) return "Cat. No.";
  return "Cat. No. / Item #";
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = clean(body.name);
    const org = clean(body.org);
    const email = clean(body.email);
    const productName = clean(body.productName) || clean(body.product);
    const referenceNo = clean(body.referenceNo) || clean(body.catalogNo) || clean(body.itemNo);
    const referenceLabel = safeLabel(body.referenceLabel || (body.itemNo ? "Item #" : body.catalogNo ? "Cat. No." : ""));
    const message = String(body.message || "").trim();
    const sourceUrl = clean(body.sourceUrl) || clean(body.sourcePage);

    if (!email || !message) {
      return Response.json({ ok: false, error: "Email and message are required." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.QUOTE_TO_EMAIL || "info@itsbio.co.kr";
    const fromEmail = process.env.QUOTE_FROM_EMAIL || "ITS BIO Website <onboarding@resend.dev>";

    if (!apiKey) {
      return Response.json({ ok: false, error: "Mail service is not configured yet." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const subjectTarget = productName || referenceNo || name || "Website inquiry";

    const text = [
      "New quote request received:",
      "",
      `Name: ${name || "-"}`,
      `Company / Lab: ${org || "-"}`,
      `Email: ${email}`,
      `Product name: ${productName || "-"}`,
      `${referenceLabel}: ${referenceNo || "-"}`,
      sourceUrl ? `Source page: ${sourceUrl}` : "",
      "",
      "Message:",
      message,
    ].filter(Boolean).join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:680px">
        <h2 style="margin:0 0 20px;color:#111827">New ITS BIO quote request</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tbody>
            <tr><td style="padding:8px 0;font-weight:700;width:150px">Name</td><td style="padding:8px 0">${escapeHtml(name || "-")}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700">Company / Lab</td><td style="padding:8px 0">${escapeHtml(org || "-")}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700">Email</td><td style="padding:8px 0">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700">Product name</td><td style="padding:8px 0">${escapeHtml(productName || "-")}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700">${escapeHtml(referenceLabel)}</td><td style="padding:8px 0">${escapeHtml(referenceNo || "-")}</td></tr>
            ${sourceUrl ? `<tr><td style="padding:8px 0;font-weight:700">Source page</td><td style="padding:8px 0"><a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></td></tr>` : ""}
          </tbody>
        </table>
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #e5e7eb">
          <div style="font-weight:700;margin-bottom:8px">Message</div>
          <div style="white-space:pre-wrap">${escapeHtml(message)}</div>
        </div>
      </div>
    `.trim();

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `[ITS BIO Quote] ${subjectTarget}`,
      text,
      html,
      replyTo: email,
    });

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
