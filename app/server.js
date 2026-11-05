'use strict';
// arteioptic.ru: serves the landing page and sends form leads by e-mail via SMTP.
// All settings come from environment variables (see README.md).

const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.PORT) || 3000;
const MAIL_TO = process.env.MAIL_TO;                 // where leads go, comma-separated
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});

// www -> apex, keep one address for search engines
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---- leads ----
const hits = new Map(); // ip -> [timestamps]
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5; // max 5 leads per IP per 10 minutes
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ['Запрос каталога', 'Оптовое сотрудничество', 'Private label', 'Другой вопрос'];

app.post('/api/lead', express.json({ limit: '20kb' }), async (req, res) => {
  const b = req.body || {};
  if (clean(b.website, 200)) return res.json({ ok: true }); // honeypot: silently drop bots
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Слишком много заявок подряд. Попробуйте позже или позвоните: +7 916 481-59-24.' });

  const lead = {
    topic: TOPICS.includes(b.topic) ? b.topic : 'Другой вопрос',
    name: clean(b.name, 200),
    company: clean(b.company, 200),
    phone: clean(b.phone, 60),
    email: clean(b.email, 200),
    business: clean(b.business, 100),
    message: clean(b.message, 2000),
  };
  if (!lead.name || !lead.company || !lead.phone || !EMAIL_RE.test(lead.email)) {
    return res.status(400).json({ error: 'Проверьте поля: имя, компания, телефон и корректный email.' });
  }
  if (b.consent !== true) return res.status(400).json({ error: 'Нужно согласие на обработку персональных данных.' });
  if (lead.business === 'Выберите вариант') lead.business = '';

  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = [
    `Тема: ${lead.topic}`,
    `Имя: ${lead.name}`,
    `Компания: ${lead.company}`,
    `Телефон: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Формат бизнеса: ${lead.business || 'не указан'}`,
    '',
    'Комментарий:',
    lead.message || 'нет',
    '',
    `Отправлено: ${when} (МСК)`,
    'Согласие на обработку персональных данных: дано (https://arteioptic.ru/consent)',
  ].join('\n');

  try {
    await transporter.sendMail({
      from: { name: 'Сайт arteioptic.ru', address: MAIL_FROM },
      to: MAIL_TO,
      replyTo: { name: lead.name, address: lead.email },
      subject: `Заявка с сайта: ${lead.topic}, ${lead.company}`,
      text,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('mail error:', err && err.message);
    res.status(502).json({ error: 'Не удалось отправить заявку. Позвоните нам: +7 916 481-59-24 или напишите на info@arteioptic.ru.' });
  }
});

// ---- static site ----
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders(res, file) {
    if (file.includes(`${path.sep}img${path.sep}`)) res.set('Cache-Control', 'public, max-age=604800');
  },
}));
app.use((req, res) => res.redirect('/'));

app.listen(PORT, () => {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'].filter((k) => !process.env[k]);
  console.log(`arteioptic.ru listening on ${PORT}` + (missing.length ? `; missing env: ${missing.join(', ')}` : ''));
});
