'use strict';

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Uploads directory ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  console.error('Kan ikke oprette upload-mappe:', err.message);
  process.exit(1);
}

// ── HTML escaping (prevent XSS in emails) ────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Multer (file upload) ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // Keep only alphanumeric characters from the extension (no path separators)
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9]/g, '');
    cb(null, ext ? `${unique}.${ext}` : `${unique}.bin`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Kun JPG og PNG filer er tilladt.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Nodemailer transporter ────────────────────────────────────────────────────
// Configure via environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('ADVARSEL: SMTP_USER og/eller SMTP_PASS er ikke sat. E-mail afsendelse virker ikke.');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// ── Price calculation helper ──────────────────────────────────────────────────
const BASE_PRICE = 4999;

const ADD_ON_PRICES = {
  extraPages: 500,
  blog: 1000,
  blogPosts: 1200,
  seoBasis: 1000,
  testimonials: 500,
  imageEditing: 250,
  videoEditing: 500,
  socialFeed: 1200,
  bookingSystem: 2800,
  newsletter: 800,
  googleMaps: 500,
  fileDownload: 400,
  faqSection: 500,
};

function calculatePrice(addOns) {
  let total = BASE_PRICE;
  if (!addOns) return total;

  if (addOns.extraPages)    total += ADD_ON_PRICES.extraPages   * Math.max(0, parseInt(addOns.extraPagesCount || 0, 10));
  if (addOns.blog)          total += ADD_ON_PRICES.blog;
  if (addOns.blogPosts)     total += ADD_ON_PRICES.blogPosts;
  if (addOns.seoBasis)      total += ADD_ON_PRICES.seoBasis;
  if (addOns.testimonials)  total += ADD_ON_PRICES.testimonials;
  if (addOns.imageEditing)  total += ADD_ON_PRICES.imageEditing * Math.max(0, parseInt(addOns.imageCount  || 0, 10));
  if (addOns.videoEditing)  total += ADD_ON_PRICES.videoEditing * Math.max(0, parseInt(addOns.videoCount  || 0, 10));
  if (addOns.socialFeed)    total += ADD_ON_PRICES.socialFeed;
  if (addOns.bookingSystem) total += ADD_ON_PRICES.bookingSystem;
  if (addOns.newsletter)    total += ADD_ON_PRICES.newsletter;
  if (addOns.googleMaps)    total += ADD_ON_PRICES.googleMaps;
  if (addOns.fileDownload)  total += ADD_ON_PRICES.fileDownload;
  if (addOns.faqSection)    total += ADD_ON_PRICES.faqSection;

  return total;
}

function formatPrice(n) {
  return n.toLocaleString('da-DK') + ' kr.';
}

// ── Cleanup uploaded files ────────────────────────────────────────────────────
function cleanupFiles(files) {
  if (!files || !files.length) return;
  for (const f of files) {
    fs.unlink(f.path, err => {
      if (err) console.error('Kunne ikke slette midlertidig fil:', f.path, err.message);
    });
  }
}

// ── Email builders ────────────────────────────────────────────────────────────
function buildAdminEmailHtml(data, files, totalPrice) {
  const fileList = files && files.length
    ? files.map(f => `<li>${esc(f.originalname)} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`).join('')
    : '<li>Ingen filer uploadet</li>';

  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><title>Ny forespørgsel</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:640px;margin:0 auto;padding:24px">
  <h1 style="color:#1e3a5f">Ny forespørgsel fra ${esc(data.name)}</h1>
  <p><strong>Estimeret pris:</strong> ${esc(formatPrice(totalPrice))}</p>
  <hr>

  <h2>Trin 1 – Kontaktinfo</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Navn:</strong></td><td>${esc(data.name)}</td></tr>
    <tr><td style="padding:6px 0"><strong>E-mail:</strong></td><td>${esc(data.email)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Telefon:</strong></td><td>${esc(data.phone)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Virksomhed:</strong></td><td>${esc(data.company)}</td></tr>
  </table>

  <h2>Trin 2 – Om virksomheden</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Branche:</strong></td><td>${esc(data.industry)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Størrelse:</strong></td><td>${esc(data.companySize)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Beskrivelse:</strong></td><td>${esc(data.companyDescription)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Mål med hjemmesiden:</strong></td><td>${esc(data.goals)}</td></tr>
  </table>

  <h2>Trin 3 – Nuværende hjemmeside</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Har hjemmeside:</strong></td><td>${esc(data.hasWebsite)}</td></tr>
    <tr><td style="padding:6px 0"><strong>URL:</strong></td><td>${esc(data.websiteUrl)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Hvad mangler:</strong></td><td>${esc(data.whatsMissing)}</td></tr>
  </table>

  <h2>Trin 4 – Omfang & funktioner</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Antal undersider:</strong></td><td>${esc(data.pageCount)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Ønskede funktioner:</strong></td><td>${esc(data.features)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Sprog:</strong></td><td>${esc(data.languages)}</td></tr>
  </table>

  <h2>Trin 5 – Design & indhold</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Stil:</strong></td><td>${esc(data.designStyle)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Farver:</strong></td><td>${esc(data.colorPreferences)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Referencer/inspiration:</strong></td><td>${esc(data.references)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Tekst/indhold:</strong></td><td>${esc(data.contentReady)}</td></tr>
  </table>

  <h2>Trin 6 – Teknik & drift</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>CMS:</strong></td><td>${esc(data.cms)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Hosting:</strong></td><td>${esc(data.hosting)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Domæne:</strong></td><td>${esc(data.domain)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Vedligeholdelse:</strong></td><td>${esc(data.maintenance)}</td></tr>
  </table>

  <h2>Trin 7 – Tilkøb & deadline</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 0;width:180px"><strong>Tilkøb:</strong></td><td style="white-space:pre-line">${esc(data.addOnsSummary)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Deadline:</strong></td><td>${esc(data.deadline)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Budget:</strong></td><td>${esc(data.budget)}</td></tr>
    <tr><td style="padding:6px 0"><strong>Ekstra bemærkninger:</strong></td><td>${esc(data.notes)}</td></tr>
  </table>

  <h2>Trin 8 – Uploadede filer</h2>
  <ul>${fileList}</ul>

  <hr>
  <p style="color:#666;font-size:13px">Sendt via Færk Webbureau formularen.</p>
</body>
</html>`;
}

function buildCustomerEmailHtml(data, totalPrice) {
  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><title>Bekræftelse – Færk Webbureau</title></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:640px;margin:0 auto;padding:24px">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="color:#1e3a5f;font-size:28px;margin-bottom:8px">Tak for din forespørgsel!</h1>
    <p style="font-size:18px;color:#555">Kære ${esc(data.name)},</p>
  </div>

  <p>Vi har modtaget dine oplysninger og vender tilbage inden for <strong>24 timer</strong>.</p>
  <p>Herunder finder du en opsummering af din forespørgsel:</p>

  <div style="background:#f8f9fa;border-radius:12px;padding:24px;margin:24px 0">
    <h2 style="color:#1e3a5f;margin-top:0">Opsummering</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;width:200px"><strong>Navn:</strong></td><td>${esc(data.name)}</td></tr>
      <tr><td style="padding:6px 0"><strong>E-mail:</strong></td><td>${esc(data.email)}</td></tr>
      <tr><td style="padding:6px 0"><strong>Virksomhed:</strong></td><td>${esc(data.company)}</td></tr>
      <tr><td style="padding:6px 0"><strong>Branche:</strong></td><td>${esc(data.industry)}</td></tr>
      <tr><td style="padding:6px 0"><strong>Deadline:</strong></td><td>${esc(data.deadline)}</td></tr>
    </table>
  </div>

  <div style="background:#1e3a5f;color:#fff;border-radius:12px;padding:24px;margin:24px 0;text-align:center">
    <p style="margin:0 0 8px;font-size:14px;opacity:0.8">Estimeret pris</p>
    <p style="margin:0;font-size:36px;font-weight:700">${esc(formatPrice(totalPrice))}</p>
    <p style="margin:8px 0 0;font-size:12px;opacity:0.7">Priser starter fra 4.999 kr.</p>
  </div>

  <h2 style="color:#1e3a5f">Næste skridt</h2>
  <ol>
    <li style="margin-bottom:8px">Vi gennemgår din forespørgsel grundigt.</li>
    <li style="margin-bottom:8px">En af vores webrådgivere kontakter dig inden for 24 timer.</li>
    <li style="margin-bottom:8px">Vi udarbejder et skræddersyet tilbud baseret på dine ønsker.</li>
    <li style="margin-bottom:8px">Har du spørgsmål i mellemtiden, er du altid velkommen til at skrive til os.</li>
  </ol>

  <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid #eee">
    <p style="color:#1e3a5f;font-weight:700;font-size:16px">Færk Webbureau</p>
    <p style="color:#666;margin:4px 0"><a href="mailto:kontakt@faerkwebbureau.dk" style="color:#1e3a5f">kontakt@faerkwebbureau.dk</a></p>
    <p style="color:#999;font-size:12px;margin-top:16px">Denne e-mail er automatisk genereret. Svar venligst ikke direkte på denne e-mail.</p>
  </div>
</body>
</html>`;
}

// ── Submit route ──────────────────────────────────────────────────────────────
app.post('/submit', upload.array('files', 20), async (req, res) => {
  const files = req.files || [];
  try {
    const data = req.body;

    // Parse add-ons (they come as a JSON string from the client)
    let addOns = {};
    try { addOns = JSON.parse(data.addOns || '{}'); } catch (_) {}

    const totalPrice = calculatePrice(addOns);

    // Build a human-readable add-ons summary
    const addOnLabels = [];
    const extraPagesCount = parseInt(addOns.extraPagesCount || 0, 10);
    if (addOns.extraPages && extraPagesCount > 0)
      addOnLabels.push(`Ekstra sider (${extraPagesCount} stk.): +${formatPrice(ADD_ON_PRICES.extraPages * extraPagesCount)}`);
    if (addOns.blog)          addOnLabels.push(`Blogopsætning: +${formatPrice(ADD_ON_PRICES.blog)}`);
    if (addOns.blogPosts)     addOnLabels.push(`3 blogindlæg: +${formatPrice(ADD_ON_PRICES.blogPosts)}`);
    if (addOns.seoBasis)      addOnLabels.push(`SEO basis: +${formatPrice(ADD_ON_PRICES.seoBasis)}`);
    if (addOns.testimonials)  addOnLabels.push(`Kundeudtalelser: +${formatPrice(ADD_ON_PRICES.testimonials)}`);
    const imgCount = parseInt(addOns.imageCount || 0, 10);
    if (addOns.imageEditing && imgCount > 0)
      addOnLabels.push(`Billedredigering (${imgCount} stk.): +${formatPrice(ADD_ON_PRICES.imageEditing * imgCount)}`);
    const vidCount = parseInt(addOns.videoCount || 0, 10);
    if (addOns.videoEditing && vidCount > 0)
      addOnLabels.push(`Videoredigering (${vidCount} stk.): +${formatPrice(ADD_ON_PRICES.videoEditing * vidCount)}`);
    if (addOns.socialFeed)    addOnLabels.push(`Social media feed: +${formatPrice(ADD_ON_PRICES.socialFeed)}`);
    if (addOns.bookingSystem) addOnLabels.push(`Booking system: +${formatPrice(ADD_ON_PRICES.bookingSystem)}`);
    if (addOns.newsletter)    addOnLabels.push(`Nyhedsbrev: +${formatPrice(ADD_ON_PRICES.newsletter)}`);
    if (addOns.googleMaps)    addOnLabels.push(`Google Maps: +${formatPrice(ADD_ON_PRICES.googleMaps)}`);
    if (addOns.fileDownload)  addOnLabels.push(`Fil-download: +${formatPrice(ADD_ON_PRICES.fileDownload)}`);
    if (addOns.faqSection)    addOnLabels.push(`FAQ sektion: +${formatPrice(ADD_ON_PRICES.faqSection)}`);

    data.addOnsSummary = addOnLabels.length
      ? addOnLabels.join('\n')
      : 'Ingen tilkøb valgt';

    // Prepare attachments
    const attachments = files.map(f => ({
      filename: f.originalname,
      path: f.path,
    }));

    // Admin email
    await transporter.sendMail({
      from: `"Færk Webbureau Formular" <${process.env.SMTP_USER || 'no-reply@faerkwebbureau.dk'}>`,
      to: 'kontakt@faerkwebbureau.dk',
      subject: `Ny forespørgsel fra ${data.name || 'ukendt'} – ${formatPrice(totalPrice)}`,
      html: buildAdminEmailHtml(data, files, totalPrice),
      attachments,
    });

    // Customer confirmation email
    if (data.email) {
      await transporter.sendMail({
        from: `"Færk Webbureau" <${process.env.SMTP_USER || 'no-reply@faerkwebbureau.dk'}>`,
        to: data.email,
        subject: 'Tak for din forespørgsel – Færk Webbureau',
        html: buildCustomerEmailHtml(data, totalPrice),
      });
    }

    // Clean up uploaded files after emails are sent
    cleanupFiles(files);

    res.json({ success: true, totalPrice });
  } catch (err) {
    console.error('Submit error:', err);
    cleanupFiles(files);
    res.status(500).json({ success: false, error: 'Der opstod en fejl ved afsendelse. Prøv igen eller kontakt os direkte.' });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Færk Webbureau formular kører på http://localhost:${PORT}`);
});
