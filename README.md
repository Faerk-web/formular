# Færk Webbureau – Formular

Et moderne, responsivt og konverteringsoptimeret trin-for-trin formularsystem til **Færk Webbureau**.

![Formular screenshot](https://github.com/user-attachments/assets/1188029d-666f-4362-a478-3fa3ca462550)

---

## Funktioner

- **8-trins guide** med progress bar og trin-indikator ("Trin X af 8")
- **Realtids-prisberegning** – grundpris 4.999 kr. + tilkøb
- **Sticky prisbox** synlig under hele flowet
- **Fil-upload** (JPG/PNG, maks. 10 MB, drag & drop)
- **Per-trin validering** – forhindrer næste trin hvis obligatoriske felter mangler
- **E-mail til kontakt@faerkwebbureau.dk** med alle indtastede data og vedhæftede filer
- **Bekræftelses-e-mail til kunden** med tak-besked, opsummering og næste skridt
- **Succesbesked på skærmen** efter indsendelse
- **Auto-gem** af formularen i `localStorage`
- Mobil-first, clean premium-design

---

## Kom i gang

### 1. Installer afhængigheder

```bash
npm install
```

### 2. Konfigurer e-mail (SMTP)

Opret en `.env`-fil (eller sæt miljøvariable direkte):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=din@email.dk
SMTP_PASS=dit-app-password
PORT=3000
```

> **Tip:** Brug et Gmail App Password eller en SMTP-tjeneste som SendGrid, Mailgun eller Postmark.

### 3. Start serveren

```bash
npm start
```

Formularen er nu tilgængelig på [http://localhost:3000](http://localhost:3000).

---

## Tilkøb & priser

| Tilkøb | Pris |
|---|---|
| Ekstra sider | +500 kr. / side |
| Blogopsætning | +1.000 kr. |
| 3 blogindlæg | +1.200 kr. |
| SEO basis | +1.000 kr. |
| Kundeudtalelser | +500 kr. |
| Billedredigering | +250 kr. / billede |
| Videoredigering | +500 kr. / video |
| Social media feed | +1.200 kr. |
| Booking system | +2.800 kr. |
| Nyhedsbrev | +800 kr. |
| Google Maps | +500 kr. |
| Fil-download | +400 kr. |
| FAQ sektion | +500 kr. |

Grundprisen er altid **4.999 kr.** og kan ikke fravælges.

---

## Teknologi

- **Node.js** + **Express** (backend)
- **Nodemailer** (e-mail afsendelse)
- **Multer** (fil-upload)
- Vanilla HTML/CSS/JS (ingen frontend framework påkrævet)
