import tls from "node:tls";

export const runtime = "nodejs";

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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(value: string) {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function responseCode(response: string) {
  const match = response.match(/(?:^|\r?\n)(\d{3})[ -][^\r\n]*$/);
  return match ? Number(match[1]) : 0;
}

function waitForResponse(socket: tls.TLSSocket, timeoutMs = 12000) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    const finish = () => {
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1) || "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };

    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      finish();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("SMTP connection closed unexpectedly."));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("SMTP response timed out."));
    }, timeoutMs);

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: number[]) {
  socket.write(`${value}\r\n`);
  const response = await waitForResponse(socket);
  const code = responseCode(response);
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed (${code || "unknown"}).`);
  }
  return response;
}

async function sendMailplugMail({
  user,
  password,
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  user: string;
  password: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}) {
  const host = process.env.MAILPLUG_SMTP_HOST || "smtp.mailplug.co.kr";
  const port = Number(process.env.MAILPLUG_SMTP_PORT || 465);

  const socket = tls.connect({
    host,
    port,
    servername: host,
    rejectUnauthorized: true,
  });

  socket.setTimeout(15000, () => socket.destroy(new Error("SMTP connection timed out.")));

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });

  try {
    const greeting = await waitForResponse(socket);
    if (responseCode(greeting) !== 220) throw new Error("SMTP server did not accept the connection.");

    await command(socket, "EHLO itsbio.co.kr", [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(user, "utf8").toString("base64"), [334]);
    await command(socket, Buffer.from(password, "utf8").toString("base64"), [235]);
    await command(socket, `MAIL FROM:<${user}>`, [250]);
    await command(socket, `RCPT TO:<${to}>`, [250, 251]);
    await command(socket, "DATA", [354]);

    const boundary = `itsbio-${Date.now().toString(36)}`;
    const message = [
      `From: ITS BIO Website <${user}>`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(html),
      `--${boundary}--`,
      "",
    ].join("\r\n");

    socket.write(`${message}\r\n.\r\n`);
    const accepted = await waitForResponse(socket);
    if (responseCode(accepted) !== 250) throw new Error("SMTP server rejected the message.");

    socket.write("QUIT\r\n");
  } finally {
    socket.end();
  }
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

    if (!isEmail(email) || !message) {
      return Response.json({ ok: false, error: "A valid email and message are required." }, { status: 400 });
    }

    const smtpUser = clean(process.env.MAILPLUG_SMTP_USER) || "info@itsbio.co.kr";
    const smtpPassword = String(process.env.MAILPLUG_SMTP_PASSWORD || "");
    const toEmail = clean(process.env.QUOTE_TO_EMAIL) || "info@itsbio.co.kr";

    if (!smtpPassword) {
      return Response.json({ ok: false, error: "Mail service is not configured yet." }, { status: 500 });
    }

    const subjectTarget = productName || referenceNo || name || "Website inquiry";
    const subject = `[ITS BIO Quote] ${subjectTarget}`;

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

    await sendMailplugMail({
      user: smtpUser,
      password: smtpPassword,
      to: toEmail,
      replyTo: email,
      subject,
      text,
      html,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Quote mail send failed:", error instanceof Error ? error.message : "Unknown SMTP error");
    return Response.json({ ok: false, error: "Unable to send email right now. Please try again." }, { status: 500 });
  }
}
