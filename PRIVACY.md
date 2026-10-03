# Политика конфиденциальности / Privacy Policy

## Русский

Bypass proxy (ru) не собирает и не передаёт данные пользователей.

Расширение обрабатывает каждый сетевой запрос браузера, определяет имя хоста и решает, отправить его напрямую или через прокси. Решение принимается локально и никуда не отправляется.

Полные URL, содержимое страниц, история переходов и cookies не собираются.

Расширение скачивает файл geosite.dat, бинарный список доменных имён, с https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest Файл используется как данные и разбирается локально, он нигде не выполняется и не передаётся в eval.

Если вы задаёте SOCKS5 в настройках, браузер отправляет запросы, не попавшие под обход, на этот прокси-сервер, а при включённом «Резолвить DNS через прокси» DNS-запросы тоже идут через него. Видят ли эти запросы оператор прокси — зависит только от него. Расширение не знает и не хранит адреса посещённых сайтов.

Настройки, параметры SOCKS5 (хост, порт, логин, пароль) и скачанный список хранятся в локальном хранилище расширения. Логин и пароль прокси сохраняются открытым текстом, как это делают другие менеджеры прокси, и удаляются кнопкой «Очистить» или удалением расширения. Учётных записей и серверов разработчика нет.

## English

Bypass proxy (ru) does not collect or transmit user data.

The add-on inspects every browser network request, determines the hostname, and decides whether to send it directly or through a proxy. This decision is made locally and never transmitted.

Full URLs, page content, browsing history, and cookies are not collected.

The add-on downloads geosite.dat, a binary list of domain names, from https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest The file is used as data and parsed locally, never executed and never passed to eval.

If you configure a SOCKS5 proxy, the browser sends requests that are not bypassed to that proxy server, and with "Resolve DNS through the proxy" enabled, DNS lookups go through it as well. Whether the proxy operator sees those requests depends only on that operator. The add-on never learns or stores the addresses you visit.

Settings, SOCKS5 details (host, port, username, password) and the downloaded list are stored in the add-on's local storage. The proxy username and password are stored as plain text, the same way other proxy managers do it, and are removed with the Clear button or by uninstalling the add-on. There are no accounts and no developer servers.
