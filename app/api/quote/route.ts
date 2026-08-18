import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = body.name ?? "";
    const org = body.org ?? "";
    const email = body.email ?? "";
    const product = body.product ?? "";
    const message = body.message ?? "";
    const sourceUrl = body.sourceUrl ?? "";

    if (!email || !message) {
      return Response.json({ ok: false, error: "Email and message are required." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.QUOTE_TO_EMAIL;

    if (!apiKey) {
      return Response.json({ ok: false, error: "Missing RESEND_API_KEY (.env.local)" }, { status: 500 });
    }
    if (!toEmail) {
      return Response.json({ ok: false, error: "Missing QUOTE_TO_EMAIL (.env.local)" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: "itsbio Quote <onboarding@resend.dev>",
      to: [toEmail],
      subject: `[Quote Request] ${product || "No product"} - ${name || "Unknown"}`,
      text: `
New quote request received:

Name: ${name}
Org: ${org}
Email: ${email}
Product/CatNo: ${product}
${sourceUrl ? `Source page: ${sourceUrl}\n` : ""}
Message:
${message}
      `.trim(),
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
