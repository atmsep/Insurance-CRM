import "server-only";

// Yuboto's OMNI API sends SMS and Viber Business Messages through the same
// endpoint and request shape (include an `sms` object, a `viber` object, or
// both — Viber-with-SMS-fallback is one request, not two calls). Docs:
// https://octapush.yuboto.com, OMNI API Documentation.
//
// Auth is HTTP Basic with the API key itself (not user:pass) base64-encoded
// as the credential — that's Yuboto's own convention, not standard Basic
// auth. Account balance/credentials are entirely external to this repo
// (Octapush account, not self-service like Resend) — this module is safe to
// ship ahead of having a real key: every function below returns
// { ok: false, error: "..." } instead of throwing when YUBOTO_API_KEY is
// unset, same convention as sendEmail in ./email.ts.

const BASE_URL = "https://services.yuboto.com/omni/v1";

function getApiKey(): string | null {
  return process.env.YUBOTO_API_KEY || null;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(apiKey).toString("base64")}`;
}

export type YubotoMessageResult = {
  id: string;
  channel: string;
  phonenumber: string;
  status: string;
  errorCode: number;
};

export type YubotoSendResult = {
  ok: boolean;
  error?: string;
  results?: YubotoMessageResult[];
};

export type SmsOptions = {
  sender: string;
  text: string;
  // Minutes the message stays queued for retry before being dropped.
  validity?: number;
  typesms?: "sms" | "flash" | "unicode";
  longsms?: boolean;
};

export type ViberOptions = {
  sender: string;
  text: string;
  // Seconds the message stays queued for retry before being dropped.
  validity?: number;
  expiryText?: string;
  buttonCaption?: string;
  buttonAction?: string;
  image?: string;
};

function smsPayload(options: SmsOptions, priority: number) {
  return {
    sender: options.sender,
    text: options.text,
    validity: options.validity ?? 1440,
    typesms: options.typesms ?? "sms",
    longsms: options.longsms ?? false,
    priority,
  };
}

async function send(payload: Record<string, unknown>): Promise<YubotoSendResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "YUBOTO_API_KEY not configured" };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/Send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: authHeader(apiKey),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ErrorCode !== 0) {
    return { ok: false, error: data?.ErrorMessage || `HTTP ${response.status}` };
  }
  return { ok: true, results: data.Message as YubotoMessageResult[] };
}

// phoneNumbers: international format without a leading "+" (e.g.
// "306912345678"), per Yuboto's ContactObj.phonenumber convention.
export async function sendSms(phoneNumbers: string[], options: SmsOptions): Promise<YubotoSendResult> {
  return send({
    contacts: phoneNumbers.map((phonenumber) => ({ phonenumber })),
    sms: smsPayload(options, 0),
  });
}

// smsFallback: when set, a recipient who can't be reached on Viber
// (not delivered, blocked the sender, expired, or errored) gets the same
// message resent as SMS automatically — one request, Yuboto handles the
// fallback server-side. Omit it to send Viber-only with no fallback.
export async function sendViber(
  phoneNumbers: string[],
  options: ViberOptions,
  smsFallback?: SmsOptions,
): Promise<YubotoSendResult> {
  const payload: Record<string, unknown> = {
    contacts: phoneNumbers.map((phonenumber) => ({ phonenumber })),
    viber: {
      sender: options.sender,
      text: options.text,
      image: options.image ?? null,
      buttonAction: options.buttonAction ?? null,
      buttonCaption: options.buttonCaption ?? null,
      validity: options.validity ?? 86400,
      expiryText: options.expiryText ?? null,
      priority: 0,
    },
  };

  if (smsFallback) {
    payload.sms = smsPayload(smsFallback, 1);
    (payload.viber as Record<string, unknown>).fallbackOnFailed = {
      notDelivered: true,
      userBlocked: true,
      expired: true,
      error: true,
      rejected: false,
    };
  }

  return send(payload);
}
