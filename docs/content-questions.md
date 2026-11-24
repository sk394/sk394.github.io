# Content questions

Gaps and guesses found while turning `docs/resume.md` into `src/content/content.seed.json`.
Answer these by editing the seed (or, once it's set up, the Notion tables).

## Dates that looked garbled in the résumé text
The résumé conversion produced `Aug 202021`, `Jan 202024` and `Aug 202022`. I used the last four digits:

| Entry | Résumé text | Used | Confirm? |
|---|---|---|---|
| University of Akron | Aug 202021 – May 2025 | 2021-08 → 2025-05 | ☐ |
| Pile Dynamics co-op | Jan 202024 – May 2025 | 2024-01 → 2025-05 | ☐ |
| EX[L] Center | Aug 202022 – May 2025 | 2022-08 → 2025-05 | ☐ |

## Missing links
The résumé shows link labels without URLs. Add them as `links` (Notion: `Links` column, one `Label=URL` per line):
- TravelMate: "Link" (repo or live site?)
- ZippyCode: "Demo"
- Neural Network Using Backpropagation: "Link"
- Earthquake research: any paper, notebook or repo?
- "portfolio" link in the header: the site itself, so I left it out.

## Profile
- `tagline` and `about` are **drafts I wrote from the résumé facts**. Rewrite them in your own voice.
- Phone number (470-815-0662) is **not published**. Add `phone` to the profile if you want it on the site.
- Résumé PDF: put the file at `public/resume.pdf` and set `resumePdf` to `/resume.pdf`, and a "Résumé" wedge appears under Contact.
- Email: the résumé uses suman.khadka0913@gmail.com, so I used that one.

## Logos (`logoDomain`)
- `pile.com` (Pile Dynamics) and `uakron.edu` (University of Akron): fetched from the official sites.
- `eckinger.com`: an assumed domain with no usable icon found, so it shows a monogram. Confirm the domain, or upload a logo in Notion (`Logo` column).
- Important Gifts Inc., Clearsky IT Solutions, EX[L] Center: no domain known, so they show monograms. Add `logoDomain` (or upload a logo) if you want one.

## Empty categories (hidden until they have rows)
- **Extracurricular**: nothing in the résumé.
- **Certifications**: nothing in the résumé.

## Skills meters
The hub meter for a skill group shows the number of skills. If you want a proficiency meter instead, set `Meter Label` and `Meter Value` (0–100%) in Notion.
