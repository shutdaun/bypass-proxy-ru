"use strict";

const el = (id) => document.getElementById(id);
const send = (message) => browser.runtime.sendMessage(message);

const DATE = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });
const MB = 1048576;

function renderProgress(geo) {
  const bar = el("geo-bar");
  const fill = el("geo-bar-fill");
  bar.hidden = !geo.pending;
  if (!geo.pending) return;

  const done = geo.loaded > 0;
  const ratio = geo.total ? Math.min(1, geo.loaded / geo.total) : 0;
  fill.style.width = (ratio * 100).toFixed(1) + "%";

  const status = el("geo-status");
  if (!done) {
    status.textContent = "Загрузка списка…";
    return;
  }
  status.textContent =
    "Загрузка " +
    (geo.loaded / MB).toFixed(1) +
    " из " +
    (geo.total / MB).toFixed(1) +
    " МБ, " +
    Math.round(ratio * 100) +
    "%";
}

function renderGeo(state) {
  const geo = state.geo;
  renderProgress(geo);
  if (!geo.size) {
    el("geo-status").textContent =
      geo.error ? "Список не загружен: " + geo.error : "Список не загружен";
    return;
  }
  const when = geo.updatedAt ? DATE.format(new Date(geo.updatedAt)) : "—";
  let text =
    geo.size +
    " доменов из файла, " +
    geo.categories +
    " категорий, обновлён " +
    when;
  if (geo.error) {
    text += ", последняя попытка не удалась: " + geo.error;
    if (geo.retryAt > Date.now()) {
      text += ", повтор " + DATE.format(new Date(geo.retryAt));
    }
  }
  el("geo-status").textContent = text;
}

function renderDomains(domains) {
  const list = el("domains");
  list.textContent = "";
  if (!domains.length) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "Список пуст";
    list.append(item);
    return;
  }
  for (const domain of domains) {
    const item = document.createElement("li");
    item.textContent = domain;
    const remove = document.createElement("button");
    remove.textContent = "Удалить";
    remove.addEventListener("click", async () => {
      render(await send({ action: "removeDomain", domain }));
    });
    item.append(remove);
    list.append(item);
  }
}

function renderSocks(state) {
  const socks = state.socks;
  el("socks-host").value = socks.host;
  el("socks-port").value = socks.port ? String(socks.port) : "";
  el("socks-username").value = socks.username;
  el("socks-password").value = socks.password;
  el("socks-proxydns").checked = socks.proxyDNS;
  el("socks-status").textContent = state.socksActive
    ? "SOCKS5 " + socks.host + ":" + socks.port
    : "Прокси не задан";
}

function collectSocks() {
  const port = Number(el("socks-port").value.trim());
  return {
    host: el("socks-host").value.trim(),
    port,
    username: el("socks-username").value,
    password: el("socks-password").value,
    proxyDNS: el("socks-proxydns").checked,
  };
}

function render(state) {
  el("enabled").checked = state.enabled;
  el("geosite").checked = state.geosite;
  el("geosite").disabled = !state.enabled;
  el("autoUpdate").checked = state.autoUpdate;
  el("interval").value = String(state.interval);
  el("domain-input").disabled = !state.enabled;
  el("domain-add").disabled = !state.enabled;
  el("geo-source").href = state.geo.source;
  renderSocks(state);
  renderGeo(state);
  renderDomains(state.domains);
  el("domains-status").textContent = state.domains.length
    ? state.domains.length + " правил"
    : "";
}

async function update(message) {
  render(await send(message));
}

for (const key of ["enabled", "geosite", "autoUpdate"]) {
  el(key).addEventListener("change", (event) =>
    update({ action: "flag", key, value: event.target.checked })
  );
}

el("interval").addEventListener("change", (event) =>
  update({ action: "interval", value: Number(event.target.value) })
);

for (const name of ["host", "port", "username", "password", "proxydns"]) {
  el("socks-" + name).addEventListener("change", () =>
    update({ action: "socks", value: collectSocks() })
  );
}

el("socks-clear").addEventListener("click", () =>
  update({ action: "clearSocks" })
);

el("update").addEventListener("click", async () => {
  el("update").disabled = true;
  renderProgress({ pending: true, loaded: 0, total: 0 });
  try {
    render(await send({ action: "update" }));
  } finally {
    el("update").disabled = false;
  }
});

el("domain-add").addEventListener("click", async () => {
  const input = el("domain-input");
  const value = input.value.trim();
  if (!value) return;
  try {
    render(await send({ action: "addDomain", domain: value }));
    input.value = "";
  } catch (error) {
    el("domains-status").textContent = String(error.message || error);
  }
});

el("domain-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") el("domain-add").click();
});

const openOptions = el("open-options");
if (openOptions) {
  openOptions.addEventListener("click", () => {
    browser.runtime.openOptionsPage().then(() => window.close());
  });
}

update({ action: "state" });

if (browser.runtime.connect) {
  const port = browser.runtime.connect({ name: "geo" });
  port.onMessage.addListener((message) => {
    if (message && message.action === "progress") renderProgress(message.progress);
  });
}
