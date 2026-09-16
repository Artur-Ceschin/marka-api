import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localeFrom } from "@/shared/locale";

describe("localeFrom", () => {
  it("reads the tag the web app sends", () => {
    assert.equal(localeFrom("pt-BR"), "pt-BR");
    assert.equal(localeFrom("en"), "en");
  });

  it("gives any Portuguese the only Portuguese offered", () => {
    assert.equal(localeFrom("pt-PT"), "pt-BR");
    assert.equal(localeFrom("pt"), "pt-BR");
  });

  it("takes the first supported language in a browser's list", () => {
    assert.equal(localeFrom("fr-FR,fr;q=0.9,pt-BR;q=0.8,en;q=0.7"), "pt-BR");
  });

  it("falls back to English when nothing is supported or sent", () => {
    assert.equal(localeFrom("de-DE,fr;q=0.9"), "en");
    assert.equal(localeFrom(undefined), "en");
    assert.equal(localeFrom(""), "en");
  });
});
