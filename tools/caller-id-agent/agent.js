// Caller ID agent — runs continuously on a PC at the office, connected via
// USB to an ETSI-FSK-capable Caller ID modem plugged into the analog phone
// line. When a call rings in, it POSTs the caller's number to the CRM,
// which looks up the client and shows a toast in every open CRM tab.
//
// This is a completely separate program from the CRM itself — a website
// cannot read serial/USB hardware, so this small script is the bridge.
//
// Setup:
//   1. npm install   (installs the "serialport" package, this folder's
//                      only dependency)
//   2. Edit the CONFIG block below: COM_PORT, CRM_API_URL, CALLER_ID_SECRET.
//   3. node agent.js
//   4. Once it's confirmed working, set it up to start automatically
//      (Windows Task Scheduler: "run at log on", or a tool like pm2/nssm
//      to run it as a Windows service) so it survives PC restarts.
//
// If your modem doesn't respond to the AT+VCID command below, or the
// caller-ID block it sends looks different from what this script expects,
// run with DEBUG_RAW=1 (see below) to print exactly what the modem sends,
// and adjust the parsing — every modem's exact wording can differ slightly.

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ---------------- CONFIG — edit these ----------------
const COM_PORT = "COM3"; // Check Windows Device Manager > Ports (COM & LPT)
const BAUD_RATE = 9600; // Most caller-ID modems use 9600; try 19200 if this doesn't work
const CRM_API_URL = "https://insurance-crm-one.vercel.app/api/incoming-call";
const CALLER_ID_SECRET = "PASTE_THE_SAME_SECRET_CONFIGURED_IN_VERCEL_HERE";
// ------------------------------------------------------

const DEBUG_RAW = process.env.DEBUG_RAW === "1";

const port = new SerialPort({ path: COM_PORT, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

port.on("open", () => {
  console.log(`[caller-id-agent] Connected to ${COM_PORT} at ${BAUD_RATE} baud.`);
  // ATZ resets the modem to defaults; AT+VCID=1 turns on Caller ID
  // reporting (the modem will emit a block of text before/around the
  // second ring, containing the caller's number).
  port.write("ATZ\r");
  setTimeout(() => port.write("AT+VCID=1\r"), 500);
});

port.on("error", (err) => {
  console.error("[caller-id-agent] Serial port error:", err.message);
});

let pendingNumber = null;

parser.on("data", (line) => {
  const text = line.trim();
  if (!text) return;
  if (DEBUG_RAW) console.log("[raw]", text);

  // Typical block looks like:
  //   RING
  //   DATE = 0810
  //   TIME = 1432
  //   NMBR = 2101234567
  const match = text.match(/NMBR\s*=\s*(\d+)/i);
  if (match) {
    pendingNumber = match[1];
    console.log("[caller-id-agent] Caller ID received:", pendingNumber);
    reportCall(pendingNumber);
  }
});

async function reportCall(phoneNumber) {
  try {
    const res = await fetch(CRM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CALLER_ID_SECRET}`,
      },
      body: JSON.stringify({ phone_number: phoneNumber }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[caller-id-agent] CRM rejected the call event:", res.status, data);
      return;
    }
    console.log(
      "[caller-id-agent] Reported to CRM —",
      data?.matched ? `matched: ${data.client_name}` : "no matching client",
    );
  } catch (err) {
    console.error("[caller-id-agent] Failed to reach the CRM:", err.message);
  }
}

process.on("SIGINT", () => {
  console.log("\n[caller-id-agent] Shutting down.");
  port.close(() => process.exit(0));
});
