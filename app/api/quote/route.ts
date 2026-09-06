import tls from "node:tls";
import { Resend } from "resend";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_LIMIT = 5;
const MAILPLUG_SMTP_HOST = "smtp.mailplug.co.kr";
const MAILPLUG_SMTP_PORT = 465;
const DEFAULT_MAILBOX = "info@itsbio.co.kr";
const requestLog = new Map<string, number[]>();

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function oneLine(value: unknown, maxLength: number) {
  return clean(value, maxLength).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
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

type SmtpResponse = { code: number; text: string };
type SmtpStage = "connection" | "greeting" | "ehlo" | "authentication" | "sender" | "recipient" | "data" | "delivery";

class MailplugSmtpError extends Error {
  stage: SmtpStage;
  status?: number;

  constructor(stage: SmtpStage, message: string, status?: number) {
    super(message);
    this.name = "MailplugSmtpError";
    this.stage = stage;
    this.status = status;
  }
}

function createResponseReader(socket: tls.TLSSocket) {
  let buffer = "";
  let current: string[] = [];
  const queued: SmtpResponse[] = [];
  const waiters: Array<{ resolve: (response: SmtpResponse) => void; reject: (error: Error) => void }> = [];
  let terminalError: Error | null = null;

  const deliver = (response: SmtpResponse) => {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(response);
    else queued.push(response);
  };

  const fail = (error: Error) => {
    terminalError = error;
    while (waiters.length) waiters.shift()?.reject(error);
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd + 1).replace(/\r?\n$/, "");
      buffer = buffer.slice(lineEnd + 1);
      current.push(line);
      const match = line.match(/^(\d{3})([ -])/);
      if (match?.[2] === " ") {
        deliver({ code: Number.parseInt(match[1], 10), text: current.join("\n") });
        current = [];
      }
      lineEnd = buffer.indexOf("\n");
    }
  });

  socket.on("error", fail);
  socket.on("close", () => {
    if (waiters.length) fail(new Error("Mailplug SMTP connection closed unexpectedly."));
  });

  return () => new Promise<SmtpResponse>((resolve, reject) => {
    if (queued.length) {
      resolve(queued.shift()!);
      return;
    }
    if (terminalError) {
      reject(terminalError);
      return;
    }
    waiters.push({ resolve, reject });
  });
}

function expect(response: SmtpResponse, accepted: number[], stage: SmtpStage) {
  if (!accepted.includes(response.code)) {
    throw new MailplugSmtpError(stage, `Mailplug SMTP ${stage} failed with status ${response.code}.`, response.code);
  }
}

function encodedSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function smtpBody(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function sendMailplugEmail({
  username,
  password,
  to,
  replyTo,
  subject,
  text,
}: {
  username: string;
  password: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}) {
  const socket = tls.connect({
    host: MAILPLUG_SMTP_HOST,
    port: MAILPLUG_SMTP_PORT,
    servername: MAILPLUG_SMTP_HOST,
    rejectUnauthorized: true,
  });
  const nextResponse = createResponseReader(socket);
  socket.setTimeout(25_000, () => socket.destroy(new Error("Mailplug SMTP connection timed out.")));

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
  } catch (error) {
    socket.destroy();
    throw new MailplugSmtpError("connection", error instanceof Error ? error.message : "Mailplug SMTP connection failed.");
  }

  const command = async (value: string, accepted: number[], stage: SmtpStage) => {
    const pending = nextResponse();
    socket.write(`${value}\r\n`);
    const response = await pending;
    expect(response, accepted, stage);
    return response;
  };

  try {
    expect(await nextResponse(), [220], "greeting");
    await command("EHLO itsbio.co.kr", [250], "ehlo");
    await command("AUTH LOGIN", [334], "authentication");
    await command(Buffer.from(username, "utf8").toString("base64"), [334], "authentication");
    await command(Buffer.from(password, "utf8").toString("base64"), [235], "authentication");
    await command(`MAIL FROM:<${username}>`, [250], "sender");
    await command(`RCPT TO:<${to}>`, [250, 251], "recipient");
    await command("DATA", [354], "data");

    const message = [
      `From: ITS BIO <${username}>`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${encodedSubject(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      smtpBody(text),
    ].join("\r\n");

    const accepted = nextResponse();
    socket.write(`${message}\r\n.\r\n`);
    expect(await accepted, [250], "delivery");

    const quitResponse = nextResponse();
    socket.write("QUIT\r\n");
    await quitResponse.catch(() => undefined);
  } catch (error) {
    if (error instanceof MailplugSmtpError) throw error;
    throw new MailplugSmtpError("connection", error instanceof Error ? error.message : "Mailplug SMTP failed.");
  } finally {
    socket.end();
  }
}

async function sendResendFallback({ to, replyTo, subject, text }: { to: string; replyTo: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.QUOTE_FROM_EMAIL || "ITS BIO <onboarding@resend.dev>",
    to: [to],
    subject,
    text,
    replyTo,
  });

  if (error) {
    console.error("Resend fallback failed:", error.message);
    return false;
  }
  return true;
}

function publicMailError(error: unknown) {
  if (!(error instanceof MailplugSmtpError)) return "Mail delivery failed before completion.";
  if (error.stage === "authentication") {
    return "Mailplug SMTP authentication failed. If external-app security is enabled, use a Mailplug app password for SMTP.";
  }
  if (error.stage === "connection" || error.stage === "greeting" || error.stage === "ehlo") {
    return "Mailplug SMTP connection failed. Please try again shortly.";
  }
  return `Mailplug SMTP failed during ${error.stage}.`;
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

    const name = oneLine(body.name, 100);
    const org = oneLine(body.org, 150);
    const email = oneLine(body.email, 254).toLowerCase();
    const phone = oneLine(body.phone, 50);
    const field = oneLine(body.field, 100);
    const department = oneLine(body.department, 100);
    const inquiryType = oneLine(body.inquiryType, 100);
    const product = oneLine(body.product, 300);
    const catNo = oneLine(body.catNo, 150);
    const message = clean(body.message, 5000);
    const sourceUrl = oneLine(body.sourceUrl, 1000);
    const privacyAccepted = body.privacyAccepted === true;

    if (!validEmail(email) || !message || !privacyAccepted) {
      return Response.json({ ok: false, error: "A valid email, message, and privacy agreement are required." }, { status: 400 });
    }

    const smtpUser = oneLine(process.env.MAILPLUG_SMTP_USER || DEFAULT_MAILBOX, 254).toLowerCase();
    const smtpPassword = String(process.env.MAILPLUG_SMTP_PASSWORD || "").trim();
    const toEmail = oneLine(process.env.QUOTE_TO_EMAIL || DEFAULT_MAILBOX, 254).toLowerCase();

    if (!validEmail(smtpUser) || !smtpPassword || !validEmail(toEmail)) {
      console.error("Quote email is not configured: Mailplug SMTP credentials are incomplete.");
      return Response.json({ ok: false, error: "The message service is temporarily unavailable because SMTP credentials are incomplete." }, { status: 503 });
    }

    const subject = `[${inquiryType || "Quote Request"}] ${product || catNo || "General inquiry"} - ${name || "Unknown"}`;
    const text = `
New website inquiry received:

Name: ${name}
Org: ${org}
Email: ${email}
Phone: ${phone}
Field: ${field}
Department: ${department}
Inquiry type: ${inquiryType}
Product name: ${product}
Cat No: ${catNo}
${sourceUrl ? `Source page: ${sourceUrl}\n` : ""}
Message:
${message}
    `.trim();

    try {
      await sendMailplugEmail({ username: smtpUser, password: smtpPassword, to: toEmail, replyTo: email, subject, text });
      return Response.json({ ok: true, provider: "mailplug" });
    } catch (mailplugError) {
      console.error("Mailplug quote delivery failed:", mailplugError instanceof Error ? mailplugError.message : mailplugError);
      if (await sendResendFallback({ to: toEmail, replyTo: email, subject, text })) {
        return Response.json({ ok: true, provider: "resend-fallback" });
      }
      return Response.json({ ok: false, error: publicMailError(mailplugError) }, { status: 502 });
    }
  } catch (error) {
    console.error("Quote request failed:", error);
    return Response.json({ ok: false, error: "We could not process your message." }, { status: 500 });
  }
}
