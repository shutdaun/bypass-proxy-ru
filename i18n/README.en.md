# Bypass proxy (ru)

![icon](../icons/icon-128.png)

[Русский](../README.md)

Firefox extension that routes Russian sites directly and everything else through SOCKS5.

## Why

Many Russian sites block VPN connections. The add-on sends domains from the geosite database directly, everything else through SOCKS5.

## Install

Install from AMO, open the options page and set SOCKS5. If SOCKS5 is not set, the proxy configured in Firefox itself is used.

## Permissions

| Permission | Why |
|---|---|
| `proxy` | Route remaining traffic to SOCKS5 |
| `<all_urls>` | Read the request domain |
| `storage` | Keep settings locally |

## Links

- AMO (https://addons.mozilla.org/firefox/addon/bypass-proxy-ru/)
- Suggestions (https://github.com/shutdaun/bypass-proxy-ru/issues)
- Privacy (https://github.com/shutdaun/bypass-proxy-ru/blob/main/PRIVACY.md)
- Version history (https://github.com/shutdaun/bypass-proxy-ru/blob/main/CHANGELOG.md)
