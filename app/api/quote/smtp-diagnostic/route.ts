import tls from "node:tls";

export const runtime = "nodejs";

const PROBE_TOKEN = "wK4er8KCUWHfbWE_9RhlRXN4";

function responseCode(response: string) {
  const lines = response.split(/\r?\n/).filter(Boolean);
  const last = lines.at(-1) || "";
  const match = last.match(/^(\d{3})[ -]/);
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
  if (!expected.includes(code)) throw new Error(`SMTP command failed (${code || "unknown"}).`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (process.env.VERCEL_ENV !== "preview" || url.searchParams.get("probe") !== PROBE_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const user = process.env.MAILPLUG_SMTP_USER || "info@itsbio.co.kr";
  const password = process.env.MAILPLUG_SMTP_PASSWORD || "";
  const host = process.env.MAILPLUG_SMTP_HOST || "smtp.mailplug.co.kr";
  const port = Number(process.env.MAILPLUG_SMTP_PORT || 465);

  if (!password) {
    return Response.json({ ok: false, configured: false, stage: "environment" }, { status: 500 });
  }

  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
  socket.setTimeout(15000, () => socket.destroy(new Error("SMTP connection timed out.")));

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
    });

    const greeting = await waitForResponse(socket);
    if (responseCode(greeting) !== 220) throw new Error("SMTP greeting failed.");

    await command(socket, "EHLO itsbio.co.kr", [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(user, "utf8").toString("base64"), [334]);
    await command(socket, Buffer.from(password, "utf8").toString("base64"), [235]);
    socket.write("QUIT\r\n");

    return Response.json({ ok: true, configured: true, authenticated: true });
  } catch (error) {
    return Response.json(
      { ok: false, configured: true, authenticated: false, error: error instanceof Error ? error.message : "SMTP probe failed" },
      { status: 500 },
    );
  } finally {
    socket.end();
  }
}
