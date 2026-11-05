import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NAVIGATION, findActiveKeys } from "@/config/navigation";

const purchasing = NAVIGATION.purchasing;

describe("sidebar active entry", () => {
  it("matches a top-level page exactly", () => {
    assert.deepEqual(findActiveKeys(purchasing, "/purchasing/suppliers"), { parentKey: "suppliers" });
  });

  it("highlights the parent entry on a detail page", () => {
    assert.deepEqual(findActiveKeys(purchasing, "/purchasing/suppliers/12"), { parentKey: "suppliers" });
    assert.deepEqual(findActiveKeys(purchasing, "/items/5/edit"), { parentKey: "items", childKey: "items-all" });
  });

  it("prefers the longest matching entry", () => {
    assert.deepEqual(findActiveKeys(purchasing, "/items/categories"), {
      parentKey: "items",
      childKey: "items-categories",
    });
  });

  it("never lets Home match other pages", () => {
    assert.deepEqual(findActiveKeys(purchasing, "/"), { parentKey: "home" });
    assert.deepEqual(findActiveKeys(purchasing, "/sync-issues"), {});
  });

  it("does not match a path that only shares a name prefix", () => {
    assert.deepEqual(findActiveKeys(purchasing, "/purchasing/suppliers-archive"), {});
  });
});
