import { describe, expect, it } from "vitest";
import { authSecret, createSessionToken, isValidSessionToken, passwordMatches, safeNextPath, SESSION_TTL_SECONDS } from "./session";

const NOW = Date.parse("2026-10-10T10:00:00Z");

describe("authSecret", () => {
  it("is null without a password, so the proxy can decide what to do", () => {
    expect(authSecret({})).toBeNull();
    expect(authSecret({ APP_PASSWORD: "   " })).toBeNull();
    expect(authSecret({ APP_PASSWORD: " pw " })).toBe("pw");
  });
});

describe("passwordMatches", () => {
  it("accepts only the exact password", () => {
    expect(passwordMatches("s3cret", "s3cret")).toBe(true);
    expect(passwordMatches("s3cret ", "s3cret")).toBe(false);
    expect(passwordMatches("", "s3cret")).toBe(false);
  });
});

describe("session tokens", () => {
  const token = createSessionToken("s3cret", NOW);

  it("are valid until they expire", () => {
    expect(isValidSessionToken(token, "s3cret", NOW)).toBe(true);
    expect(isValidSessionToken(token, "s3cret", NOW + (SESSION_TTL_SECONDS - 1) * 1000)).toBe(true);
    expect(isValidSessionToken(token, "s3cret", NOW + SESSION_TTL_SECONDS * 1000)).toBe(false);
  });

  it("are rejected when tampered with, signed with another password, or missing", () => {
    const [expires, signature] = token.split(".");
    expect(isValidSessionToken(`${Number(expires) + 3600}.${signature}`, "s3cret", NOW)).toBe(false);
    expect(isValidSessionToken(token, "changed", NOW)).toBe(false);
    expect(isValidSessionToken(undefined, "s3cret", NOW)).toBe(false);
    expect(isValidSessionToken("not-a-token", "s3cret", NOW)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/proposals/abc?x=1", "/proposals/abc?x=1"],
    ["/", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/login", "/"],
    [null, "/"],
  ])("maps %j to %j", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });
});
