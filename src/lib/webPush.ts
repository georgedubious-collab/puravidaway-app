import { createECDH, createHmac, createCipheriv, createPrivateKey, createPublicKey, randomBytes, sign, verify, type KeyObject } from "node:crypto";

/**
 * Web Push for the admin site (team alerts, 2026-11-12), with Node's own `crypto` and no library.
 *
 *   - Message encryption: RFC 8291 ("aes128gcm", one record), checked against the RFC's example.
 *   - Sender identity: VAPID, RFC 8292 (a short ES256-signed token per push service).
 *
 * Keys live in Vercel, never in the code: VAPID_PUBLIC_KEY (65-byte uncompressed P-256 point,
 * base64url) and VAPID_PRIVATE_KEY (32 bytes, base64url), plus VAPID_SUBJECT ("mailto:…").
 * This file has no server-only import so the tests can run it; it is only used on the server.
 */

export const b64u = {
  encode: (b: Uint8Array | Buffer): string => Buffer.from(b).toString("base64url"),
  decode: (s: string): Buffer => Buffer.from(s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"), "base64url"),
};

/** The subscription the browser hands us (PushSubscription.toJSON()). */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function leftPad32(b: Buffer): Buffer {
  return b.length >= 32 ? b.subarray(b.length - 32) : Buffer.concat([Buffer.alloc(32 - b.length), b]);
}

/** The VAPID key pair as a Node key object (from the raw base64url values in Vercel). */
export function vapidPrivateKey(publicKey: string, privateKey: string): KeyObject {
  const pub = b64u.decode(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 key (base64url).");
  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64u.encode(pub.subarray(1, 33)),
      y: b64u.encode(pub.subarray(33, 65)),
      d: b64u.encode(leftPad32(b64u.decode(privateKey))),
    },
    format: "jwk",
  });
}

export function vapidPublicKeyObject(publicKey: string): KeyObject {
  const pub = b64u.decode(publicKey);
  return createPublicKey({
    key: { kty: "EC", crv: "P-256", x: b64u.encode(pub.subarray(1, 33)), y: b64u.encode(pub.subarray(33, 65)) },
    format: "jwk",
  });
}

/** The push service's origin, which is the token's audience ("aud"). */
export function pushAudience(endpoint: string): string {
  const u = new URL(endpoint);
  if (u.protocol !== "https:") throw new Error("Push endpoints must be https.");
  return u.origin;
}

/** A signed VAPID token (JWT, ES256) for one push service, valid for `ttlSeconds` (max 24 h). */
export function vapidJwt(keys: VapidKeys, audience: string, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 12 * 3600): string {
  const header = b64u.encode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.encode(Buffer.from(JSON.stringify({ aud: audience, exp: nowSeconds + Math.min(ttlSeconds, 24 * 3600), sub: keys.subject })));
  const input = `${header}.${claims}`;
  const sig = sign("sha256", Buffer.from(input), { key: vapidPrivateKey(keys.publicKey, keys.privateKey), dsaEncoding: "ieee-p1363" });
  return `${input}.${b64u.encode(sig)}`;
}

/** The Authorization header value: `vapid t=<jwt>, k=<public key>` (RFC 8292 §3). */
export function vapidAuthorization(keys: VapidKeys, endpoint: string, nowSeconds?: number): string {
  return `vapid t=${vapidJwt(keys, pushAudience(endpoint), nowSeconds)}, k=${keys.publicKey}`;
}

/** Check a VAPID token's signature (tests, and the RFC 8292 example). */
export function verifyVapidJwt(jwt: string, publicKey: string): boolean {
  const [h, c, s] = jwt.split(".");
  if (!h || !c || !s) return false;
  return verify("sha256", Buffer.from(`${h}.${c}`), { key: vapidPublicKeyObject(publicKey), dsaEncoding: "ieee-p1363" }, b64u.decode(s));
}

const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/**
 * Encrypt one push message for one browser (RFC 8291, aes128gcm, single record).
 * `salt` and the sender's one-time key are random; the tests pass fixed ones to reproduce the RFC.
 */
export function encryptPayload(
  target: { p256dh: string; auth: string },
  plaintext: Buffer | string,
  fixed?: { salt: Buffer; senderPrivateKey: Buffer },
): Buffer {
  const uaPublic = b64u.decode(target.p256dh);
  const authSecret = b64u.decode(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Bad subscription keys.");
  const ecdh = createECDH("prime256v1");
  if (fixed) ecdh.setPrivateKey(fixed.senderPrivateKey);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = fixed?.salt ?? randomBytes(16);

  // RFC 8291 §3.3–3.4.
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);

  const data = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]); // 0x02: last (only) record
  const recordSize = 4096;
  if (data.length + 16 > recordSize) throw new Error("Push message too long.");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

export type PushOutcome = "sent" | "gone" | "failed";

/** What a push service's HTTP status means for the stored subscription. */
export function pushOutcome(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "gone"; // the browser unsubscribed or the phone dropped it
  return "failed";
}

/** Send one encrypted message. Never throws; a network error counts as "failed". */
export async function sendWebPush(
  target: PushTarget,
  payload: string,
  keys: VapidKeys,
  opts: { ttlSeconds?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ outcome: PushOutcome; status: number }> {
  try {
    const body = encryptPayload(target, payload);
    const res = await (opts.fetchImpl ?? fetch)(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(keys, target.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttlSeconds ?? 6 * 3600),
        Urgency: opts.urgency ?? "high",
        ...(opts.topic ? { Topic: opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
      },
      body: new Uint8Array(body),
    });
    return { outcome: pushOutcome(res.status), status: res.status };
  } catch (e) {
    console.error("[web push]", e instanceof Error ? e.message : e);
    return { outcome: "failed", status: 0 };
  }
}

/** VAPID settings from Vercel, or null when push isn't set up yet (then only email goes out). */
export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidKeys | null {
  const publicKey = (env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (env.VAPID_SUBJECT || "").trim();
  if (!publicKey || !privateKey || !/^(mailto:|https:)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}
