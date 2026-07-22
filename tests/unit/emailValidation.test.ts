import { describe, it, expect } from "vitest";
import { emailDomain, isDisposableEmail } from "../../app/lib/emailValidation";

describe("emailDomain", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomain("User@Example.COM")).toBe("example.com");
  });

  it("uses the last @ for addresses with multiple", () => {
    expect(emailDomain("weird@name@gmail.com")).toBe("gmail.com");
  });

  it("returns null for malformed addresses", () => {
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("trailing@")).toBeNull();
  });
});

describe("isDisposableEmail", () => {
  it("blocks known throwaway domains (case-insensitive)", () => {
    expect(isDisposableEmail("abuse@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@Guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("x@10minutemail.com")).toBe(true);
  });

  it("allows real providers and custom domains", () => {
    expect(isDisposableEmail("real.person@gmail.com")).toBe(false);
    expect(isDisposableEmail("founder@acme.co")).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(isDisposableEmail("garbage")).toBe(false);
  });
});
