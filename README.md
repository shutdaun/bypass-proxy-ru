# Bypass proxy (ru)

![icon](icons/icon-128.png)

[English](i18n/README.en.md)

## Зачем

Многие российские сайты блокируют подключение через VPN. Расширение отправляет домены из базы geosite напрямую, остальное — через SOCKS5.

## Установка

Установи из AMO, открой настройки и укажи SOCKS5. Если SOCKS5 не задан, используется прокси, настроенный в самом Firefox.

## Разрешения

| Разрешение | Зачем |
|---|---|
| `proxy` | Направлять остальной трафик на SOCKS5 |
| `<all_urls>` | Читать домен запроса |
| `storage` | Хранить настройки локально |

## Ссылки

- [AMO](https://addons.mozilla.org/firefox/addon/bypass-proxy-ru/)
- [Предложения](https://github.com/shutdaun/bypass-proxy-ru/issues)
- [Приватность](PRIVACY.md)
- [История версий](CHANGELOG.md)
