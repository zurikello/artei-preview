# arteioptic.ru

Лендинг АРТЕЙ: статические страницы и отправка заявок из формы на почту.

- `public/` — сайт: `index.html`, `privacy.html`, `consent.html`, картинки, `robots.txt`, `sitemap.xml`.
- `server.js` — Node.js (Express): отдаёт `public/` и принимает заявки на `POST /api/lead`, отправляет их письмом через SMTP.

## Запуск

```
npm install
npm start
```

## Переменные окружения

| Переменная | Что это | Пример |
| --- | --- | --- |
| `SMTP_HOST` | SMTP-сервер почты, с которой отправляются заявки | из настроек почты SpaceWeb |
| `SMTP_PORT` | Порт SMTP (465 = SSL) | `465` |
| `SMTP_USER` | Логин ящика-отправителя | `info@arteioptic.ru` |
| `SMTP_PASS` | Пароль этого ящика | — |
| `MAIL_TO` | Куда приходят заявки, можно несколько через запятую | `zurikello@gmail.com` |
| `MAIL_FROM` | Адрес отправителя (по умолчанию `SMTP_USER`) | `info@arteioptic.ru` |
| `PORT` | Порт сервера (обычно задаёт хостинг) | `3000` |

Сменить получателя заявок: поменять `MAIL_TO` в настройках приложения и перезапустить его.

Проверка работы: `GET /healthz` возвращает `{"ok":true}`.
