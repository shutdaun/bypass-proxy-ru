"use strict";

const PB = (() => {
  const SCHEME = /^(https?|wss?|ftp|file|\*):\/\//i;

  const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

  function toRegExp(pattern) {
    let out = "";
    for (const char of pattern) out += char === "*" ? "[\\s\\S]*" : escape(char);
    return new RegExp("^" + out + "$", "i");
  }

  function normalize(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (SCHEME.test(value) || value.includes("/")) {
      return value.includes("://") ? value : "*://" + value.replace(/^\/+/, "");
    }
    return value.toLowerCase();
  }

  function hostTest(url, rx) {
    if (!url) return false;
    try {
      return rx.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  function compile(raw) {
    const value = normalize(raw);
    if (!value) return null;

    if (SCHEME.test(value)) {
      const anyScheme = /^\*:(?:\/\/)?/.test(value);
      const body = value.replace(/^\*:(?:\/\/)?/, "").toLowerCase();
      const strip = (url) => {
        const lower = url.toLowerCase();
        return anyScheme ? lower.replace(/^[a-z0-9+.-]+:\/\//, "") : lower;
      };
      if (body.includes("*")) {
        const rx = toRegExp(body);
        return { raw: value, test: (url) => rx.test(strip(url)) };
      }
      return {
        raw: value,
        test: (url) => {
          const candidate = strip(url);
          return (
            candidate === body ||
            candidate.startsWith(body + "/") ||
            candidate.startsWith(body + "?") ||
            candidate.startsWith(body + "#") ||
            candidate.startsWith(body + ":")
          );
        },
      };
    }

    const subdomainsOnly = value.startsWith("*.");
    const host = value.replace(/^\*\./, "").replace(/\.$/, "");
    if (host.includes("*")) {
      const rx = toRegExp(host);
      return { raw: value, test: (url) => hostTest(url, rx) };
    }
    const labels = subdomainsOnly ? "[a-z0-9_-]+\\." : "(?:[a-z0-9_-]+\\.)*";
    const rx = new RegExp("^" + labels + escape(host) + "$", "i");
    return { raw: value, test: (url) => hostTest(url, rx) };
  }

  return { normalize, compile, compileAll: (list) => list.map(compile).filter(Boolean) };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PB;
}
