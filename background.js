"use strict";

const FLAGS = ["enabled", "geosite", "autoUpdate"];
const INTERVALS = [1, 7, 30];
const DEFAULTS = {
  enabled: true,
  geosite: true,
  autoUpdate: true,
  interval: 7,
  domains: [],
  socks: { host: "", port: 0, username: "", password: "", proxyDNS: true },
};
const GEO_KEY = "geosite";
const DAY = 86400000;
const HOUR = 3600000;
const TICK = HOUR;
const RETRY = 6 * HOUR;
const DIRECT = [null];
const PROXY = undefined;

const state = {
  ...DEFAULTS,
  socks: { ...DEFAULTS.socks },
  domains: [],
  matchers: [],
  geo: GeoSite.empty,
  geoUpdatedAt: 0,
  geoError: "",
  geoFailedAt: 0,
  geoPending: false,
  geoLoaded: 0,
  geoTotal: 0,
};

const ports = [];

const ready = init();

async function init() {
  const stored = await browser.storage.local.get(["settings", GEO_KEY]);
  const saved = stored.settings || {};

  for (const key of FLAGS) {
    if (typeof saved[key] === "boolean") state[key] = saved[key];
  }
  if (INTERVALS.includes(saved.interval)) state.interval = saved.interval;
  state.domains = Array.isArray(saved.domains)
    ? saved.domains.filter((item) => typeof item === "string" && item.trim())
    : [];
  state.matchers = PB.compileAll(state.domains);
  state.socks = normalizeSocks(saved.socks);

  if (stored[GEO_KEY] && stored[GEO_KEY].domains) {
    applyGeo(stored[GEO_KEY]);
  }
  startTimer();
  scheduleUpdate();
}

function normalizeSocks(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const port = Number(value.port);
  return {
    host: String(value.host || "").trim(),
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 0,
    username: String(value.username || ""),
    password: String(value.password || ""),
    proxyDNS: value.proxyDNS !== false,
  };
}

async function save() {
  await browser.storage.local.set({
    settings: {
      enabled: state.enabled,
      geosite: state.geosite,
      autoUpdate: state.autoUpdate,
      interval: state.interval,
      domains: state.domains,
      socks: state.socks,
    },
  });
}

function applyGeo(geo) {
  state.geo = GeoSite.compile(geo.domains);
  state.geoUpdatedAt = Number.isFinite(geo.updatedAt) ? geo.updatedAt : 0;
  state.geoError = "";
  state.geoFailedAt = 0;
}

function retryAfter() {
  if (!state.geoFailedAt) return 0;
  return Math.max(0, RETRY - (Date.now() - state.geoFailedAt));
}

function due() {
  if (!state.autoUpdate) return false;
  if (retryAfter() > 0) return false;
  const age = Date.now() - state.geoUpdatedAt;
  return !state.geoUpdatedAt || age > state.interval * DAY;
}

function scheduleUpdate() {
  if (!due()) return;
  updateGeo();
}

function startTimer() {
  setInterval(scheduleUpdate, TICK);
}

function setProgress({ loaded, total }) {
  state.geoLoaded = loaded;
  state.geoTotal = total;
  broadcast({ action: "progress", progress: status().geo });
}

async function updateGeo() {
  if (state.geoPending) return status();
  state.geoPending = true;
  state.geoLoaded = 0;
  state.geoTotal = 0;
  try {
    const data = await GeoSite.download(setProgress);
    const geo = { domains: data, updatedAt: Date.now() };
    await browser.storage.local.set({ [GEO_KEY]: geo });
    applyGeo(geo);
    state.geoFailedAt = 0;
  } catch (error) {
    state.geoError = String(error.message || error);
    state.geoFailedAt = Date.now();
  }
  state.geoPending = false;
  state.geoLoaded = 0;
  state.geoTotal = 0;
  return status();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function socksInfo() {
  const socks = state.socks;
  if (!socks.host || !socks.port) return PROXY;
  const info = {
    type: "socks",
    host: socks.host,
    port: socks.port,
    proxyDNS: socks.proxyDNS,
  };
  if (socks.username) info.username = socks.username;
  if (socks.password) info.password = socks.password;
  return info;
}

function decide(details) {
  const host = hostOf(details.url);
  if (host && state.geosite && state.geo.test(host)) return "geosite";

  for (const matcher of state.matchers) {
    if (matcher.test(details.url)) return matcher.raw;
    if (details.documentUrl !== details.url && matcher.test(details.documentUrl)) {
      return matcher.raw;
    }
  }
  return null;
}

async function onRequest(details) {
  await ready;
  try {
    if (!state.enabled) return PROXY;
    return decide(details) ? DIRECT : socksInfo();
  } catch (error) {
    console.error("[bypass-proxy-ru]", error);
    return PROXY;
  }
}

browser.proxy.onRequest.addListener(onRequest, { urls: ["<all_urls>"] });

browser.proxy.onError.addListener((error) => {
  console.error("[bypass-proxy-ru]", JSON.stringify(error));
});

browser.runtime.onStartup.addListener(scheduleUpdate);

function status() {
  const socks = state.socks;
  return {
    enabled: state.enabled,
    geosite: state.geosite,
    autoUpdate: state.autoUpdate,
    interval: state.interval,
    domains: state.domains.slice(),
    socks: { ...socks },
    socksActive: Boolean(socks.host && socks.port),
    geo: {
      size: state.geo.size,
      categories: state.geo.categories.length,
      updatedAt: state.geoUpdatedAt,
      pending: state.geoPending,
      loaded: state.geoLoaded,
      total: state.geoTotal,
      error: state.geoError,
      retryAt: state.geoFailedAt ? state.geoFailedAt + RETRY : 0,
      source: GeoSite.SOURCE,
    },
  };
}

function snapshot() {
  return Promise.resolve(status());
}

function broadcast(message) {
  for (const port of ports.slice()) {
    try {
      port.postMessage(message);
    } catch {
      ports.splice(ports.indexOf(port), 1);
    }
  }
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "geo") return;
  ports.push(port);
  port.onDisconnect.addListener(() => ports.splice(ports.indexOf(port), 1));
  port.postMessage({ action: "progress", progress: status().geo });
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.action !== "string") return undefined;

  switch (message.action) {
    case "state":
      return ready.then(snapshot);

    case "flag":
      if (!FLAGS.includes(message.key)) return Promise.reject(new Error("неизвестный параметр"));
      state[message.key] = Boolean(message.value);
      return save().then(snapshot);

    case "interval":
      if (!INTERVALS.includes(message.value)) return Promise.reject(new Error("неизвестный период"));
      state.interval = message.value;
      return save().then(snapshot);

    case "update":
      return updateGeo().then(snapshot);

    case "checkUpdate":
      return Promise.resolve(scheduleUpdate()).then(snapshot);

    case "addDomain": {
      const domain = PB.normalize(message.domain);
      if (!domain) return Promise.reject(new Error("пустое правило"));
      if (!state.domains.some((item) => item.toLowerCase() === domain.toLowerCase())) {
        state.domains.push(domain);
        state.matchers = PB.compileAll(state.domains);
        save();
      }
      return snapshot();
    }

    case "removeDomain":
      state.domains = state.domains.filter((item) => item !== message.domain);
      state.matchers = PB.compileAll(state.domains);
      return save().then(snapshot);

    case "socks":
      state.socks = normalizeSocks(message.value);
      return save().then(snapshot);

    case "clearSocks":
      state.socks = { ...DEFAULTS.socks };
      return save().then(snapshot);

    default:
      return undefined;
  }
});
