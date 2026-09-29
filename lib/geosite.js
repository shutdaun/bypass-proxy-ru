"use strict";

const GeoSite = (() => {
  const SOURCE =
    "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat";
  const RU_CATEGORY = /(^|[-_])(ru|cis)([-_]|$)/i;
  const MAX_REGEX = 300;
  const decoder = new TextDecoder("utf-8");

  function varint(buf, cursor) {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      byte = buf[cursor.p++];
      if (cursor.p > cursor.end || shift > 49) return -1;
      value += (byte & 0x7f) * Math.pow(2, shift);
      shift += 7;
    } while (byte & 0x80);
    return value;
  }

  function key(buf, cursor) {
    const raw = varint(buf, cursor);
    if (raw < 0) return null;
    return [Math.floor(raw / 8), raw % 8];
  }

  function value(buf, cursor, wire, limit) {
    if (wire === 0) {
      const number = varint(buf, cursor);
      return number < 0 ? null : [number, -1];
    }
    if (wire === 1) {
      cursor.p += 8;
      return [-1, -1];
    }
    if (wire === 5) {
      cursor.p += 4;
      return [-1, -1];
    }
    if (wire !== 2) return null;
    const length = varint(buf, cursor);
    if (length < 0 || cursor.p + length > limit) return null;
    const from = cursor.p;
    cursor.p += length;
    return [from, cursor.p];
  }

  function text(buf, span) {
    return decoder.decode(buf.subarray(span[0], span[1]));
  }

  function domain(buf, from, to) {
    const cursor = { p: from, end: to };
    let type = 0;
    let name = "";
    let field = key(buf, cursor);
    while (field) {
      const before = cursor.p;
      const span = value(buf, cursor, field[1], to);
      if (!span || cursor.p <= before) break;
      const [number, wire] = field;
      field = key(buf, cursor);
      if (number === 1 && wire === 0) type = span[0];
      else if (number === 2 && wire === 2 && span[1] > span[0]) {
        name = text(buf, span).trim().toLowerCase();
      }
    }
    return name ? [type, name] : null;
  }

  function includeName(buf, from, to) {
    const cursor = { p: from, end: to };
    const field = key(buf, cursor);
    if (!field || field[0] !== 1 || field[1] !== 2) return "";
    const span = value(buf, cursor, field[1], to);
    return span ? text(buf, span).toUpperCase() : "";
  }

  function sites(buf) {
    const out = new Map();
    const top = { p: 0, end: buf.length };
    let field = key(buf, top);
    while (field) {
      const before = top.p;
      const span = value(buf, top, field[1], buf.length);
      if (!span || top.p <= before) break;
      const [number, wire] = field;
      field = key(buf, top);
      if (number !== 1 || wire !== 2) continue;

      const site = { name: "", domains: [], includes: [] };
      const cursor = { p: span[0], end: span[1] };
      let inner = key(buf, cursor);
      while (inner) {
        const mark = cursor.p;
        const part = value(buf, cursor, inner[1], span[1]);
        if (!part || cursor.p <= mark) break;
        const [sub, subWire] = inner;
        inner = key(buf, cursor);
        if (subWire !== 2) continue;
        if (sub === 1) site.name = text(buf, part).toUpperCase();
        else if (sub === 2) {
          const entry = domain(buf, part[0], part[1]);
          if (entry) site.domains.push(entry);
        } else if (sub === 3) {
          const included = includeName(buf, part[0], part[1]);
          if (included) site.includes.push(included);
        }
      }
      if (site.name) out.set(site.name, site);
    }
    return out;
  }

  function ruClosure(all) {
    const wanted = new Set();
    const queue = [];
    for (const name of all.keys()) {
      if (RU_CATEGORY.test(name)) {
        wanted.add(name);
        queue.push(name);
      }
    }
    while (queue.length) {
      for (const name of all.get(queue.pop()).includes) {
        if (!wanted.has(name) && all.has(name)) {
          wanted.add(name);
          queue.push(name);
        }
      }
    }
    return wanted;
  }

  function collect(buf) {
    const all = sites(buf);
    const data = { full: [], sub: [], keyword: [], regex: [], categories: [] };
    for (const name of ruClosure(all)) {
      data.categories.push(name);
      for (const [type, host] of all.get(name).domains) {
        if (!host) continue;
        if (type === 3) data.full.push(host);
        else if (type === 2) data.sub.push(host);
        else if (type === 0) data.keyword.push(host);
        else if (type === 1 && data.regex.length < MAX_REGEX) data.regex.push(host);
      }
    }
    return data;
  }

  function compile(data) {
    const full = new Set(data.full);
    const sub = new Set(data.sub);
    const regex = [];
    for (const source of data.regex) {
      try {
        regex.push(new RegExp(source));
      } catch {
        continue;
      }
    }
    return {
      categories: data.categories,
      size: full.size + sub.size + data.keyword.length + regex.length,
      test(host) {
        if (!host) return false;
        let label = host;
        for (;;) {
          if (full.has(label) || sub.has(label)) return true;
          const dot = label.indexOf(".");
          if (dot < 0) break;
          label = label.slice(dot + 1);
        }
        for (const part of data.keyword) {
          if (host.includes(part)) return true;
        }
        for (const rx of regex) {
          if (rx.test(host)) return true;
        }
        return false;
      },
    };
  }

  const empty = { categories: [], size: 0, test: () => false };

  async function download(onProgress) {
    const report = typeof onProgress === "function" ? onProgress : () => {};

    let response;
    try {
      response = await fetch(SOURCE, { cache: "no-cache" });
    } catch {
      throw new Error("сеть недоступна");
    }
    if (!response.ok) {
      throw new Error(
        response.status === 404 ? "файл не найден на сервере" : "ответ сервера: код " + response.status
      );
    }

    const total = Number(response.headers.get("content-length")) || 0;
    let loaded = 0;
    const chunks = [];

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          report({ loaded, total });
        }
      } catch {
        throw new Error("обрыв связи при загрузке");
      }
    } else {
      const buffer = await response.arrayBuffer();
      loaded = buffer.byteLength;
      chunks.push(new Uint8Array(buffer));
    }

    const bytes = new Uint8Array(loaded);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    if (loaded < 1024) throw new Error("файл повреждён или слишком мал");

    const data = collect(bytes);
    if (!data.categories.length) throw new Error("в файле нет российских категорий");
    return data;
  }

  return { SOURCE, collect, compile, download, empty };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = GeoSite;
}
