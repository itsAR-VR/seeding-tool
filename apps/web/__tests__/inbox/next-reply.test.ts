import { describe, it, expect } from "vitest";
import { adjacentReply, needsYourCall } from "@/app/(platform)/inbox/next-reply";

describe("needsYourCall", () => {
  it("is true only when undecided and the creator wrote last", () => {
    expect(needsYourCall(null, "inbound")).toBe(true);
    expect(needsYourCall(null, "outbound")).toBe(false);
    expect(needsYourCall(null, undefined)).toBe(false);
    expect(needsYourCall("later", "inbound")).toBe(false);
    expect(needsYourCall("no", "inbound")).toBe(false);
  });
});

describe("adjacentReply", () => {
  const order = ["a", "b", "c", "d"];

  it("goes to the next waiting reply in tab order", () => {
    expect(adjacentReply(order, order, "b", "next")).toBe("c");
    expect(adjacentReply(order, order, "b", "previous")).toBe("a");
  });

  it("keeps its place after the current one is decided and drops out of the queue", () => {
    expect(adjacentReply(order, ["a", "c", "d"], "b", "next")).toBe("c");
    expect(adjacentReply(order, ["a", "c", "d"], "b", "previous")).toBe("a");
  });

  it("skips replies that were decided elsewhere", () => {
    expect(adjacentReply(order, ["a", "d"], "b", "next")).toBe("d");
    expect(adjacentReply(order, ["d"], "c", "previous")).toBeNull();
  });

  it("offers new replies that arrived, then wraps to skipped ones", () => {
    expect(adjacentReply(order, ["e", "a"], "d", "next")).toBe("e");
    expect(adjacentReply(order, ["a"], "d", "next")).toBe("a");
  });

  it("returns null when nothing else is waiting", () => {
    expect(adjacentReply(order, [], "b", "next")).toBeNull();
    expect(adjacentReply(order, ["b"], "b", "next")).toBeNull();
    expect(adjacentReply([], [], "x", "next")).toBeNull();
  });

  it("starts from the top when the open thread isn't in the queue", () => {
    expect(adjacentReply(order, ["c", "d"], "zz", "next")).toBe("c");
    expect(adjacentReply(order, ["c", "d"], "zz", "previous")).toBeNull();
  });
});
