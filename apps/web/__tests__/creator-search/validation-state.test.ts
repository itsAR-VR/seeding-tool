import { describe, expect, it } from "vitest";
import { mapValidationStatusFromErrorCode } from "@/lib/instagram/validator";

describe("instagram validation status mapping", () => {
  it("keeps successful validations valid", () => {
    expect(mapValidationStatusFromErrorCode(null)).toBe("valid");
  });

  it("treats blocked and parse failures as unknown", () => {
    expect(mapValidationStatusFromErrorCode("blocked_or_login_wall")).toBe("unknown");
    expect(mapValidationStatusFromErrorCode("follower_count_not_found")).toBe("unknown");
  });

  it("treats transport failures as retry", () => {
    expect(mapValidationStatusFromErrorCode("timeout")).toBe("retry");
    expect(mapValidationStatusFromErrorCode("navigation_failed")).toBe("retry");
  });

  it("keeps hard negatives invalid", () => {
    expect(mapValidationStatusFromErrorCode("missing_profile")).toBe("invalid");
    expect(mapValidationStatusFromErrorCode("zero_followers")).toBe("invalid");
    expect(mapValidationStatusFromErrorCode("out_of_range")).toBe("invalid");
  });
});
