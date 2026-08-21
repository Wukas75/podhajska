import { format, parseISO } from 'date-fns';
import type { BrewSheet } from '../types/database.types';
import type { BrewSheetIngredientWithDetails } from '../hooks/useBrewSheets';
import type { BrewSheetProcessStep } from '../types/database.types';

const CATEGORY_LABELS: Record<string, string> = {
  malt: 'Slad',
  hops: 'Chmeľ',
  yeast: 'Kvasinky',
  other: 'Ostatné',
};

function esc(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildBrewSheetHtml(
  sheet: BrewSheet,
  ingredients: BrewSheetIngredientWithDetails[],
  processSteps: BrewSheetProcessStep[]
): string {
  const totalPrice = ingredients.reduce((sum, it) => sum + (it.total_price ?? 0), 0);

  const ingredientRows = ingredients
    .map(
      (it) => `
        <tr>
          <td>${esc(it.ingredient?.name ?? '—')}</td>
          <td>${esc(it.ingredient ? CATEGORY_LABELS[it.ingredient.category] ?? it.ingredient.category : '')}</td>
          <td>${esc(it.quantity)} ${esc(it.ingredient?.unit ?? '')}</td>
          <td>${it.total_price != null ? esc(it.total_price.toFixed(2)) + ' €' : ''}</td>
        </tr>`
    )
    .join('');

  const processRows = processSteps
    .map(
      (s) => `
        <tr>
          <td>${esc(s.step_name)}</td>
          <td>${esc(s.value_2)}</td>
          <td>${esc(s.value_3)}</td>
          <td>${esc(s.value_4)}</td>
          <td>${esc(s.value_5)}</td>
          <td>${esc(s.value_6)}</td>
        </tr>`
    )
    .join('');

  const results = [
    sheet.final_volume_liters != null ? `Finálny objem: ${esc(sheet.final_volume_liters)} l` : null,
    sheet.og != null ? `OG: ${esc(sheet.og)}` : null,
    sheet.sg != null ? `SG: ${esc(sheet.sg)}` : null,
    sheet.abv_percent != null ? `Alkohol: ${esc(sheet.abv_percent)} %` : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  return `
    <!doctype html>
    <html lang="sk">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .meta { color: #555; font-size: 13px; margin-bottom: 4px; }
        .notes { color: #777; font-size: 13px; margin-bottom: 16px; }
        h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.02em; color: #555; margin: 24px 0 8px; border-top: 1px solid #ddd; padding-top: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
        th { color: #666; text-transform: uppercase; font-size: 11px; }
        .total { text-align: right; font-weight: 700; margin-top: 6px; font-size: 13px; }
        .empty { color: #999; font-style: italic; font-size: 13px; }
      </style>
    </head>
    <body>
      <h1>${esc(sheet.name)}</h1>
      <div class="meta">Várka #${esc(sheet.batch_number)} &nbsp;·&nbsp; ${esc(format(parseISO(sheet.brew_date), 'd.M.yyyy'))} &nbsp;·&nbsp; ${esc(sheet.batch_volume_liters)} l</div>
      ${sheet.notes ? `<div class="notes">${esc(sheet.notes)}</div>` : ''}

      <h2>Výsledky várky</h2>
      ${results ? `<div class="meta">${results}</div>` : '<div class="empty">Zatiaľ nezadané.</div>'}

      <h2>Suroviny</h2>
      ${
        ingredients.length
          ? `<table>
              <thead><tr><th>Surovina</th><th>Kategória</th><th>Množstvo</th><th>Cena</th></tr></thead>
              <tbody>${ingredientRows}</tbody>
            </table>
            ${totalPrice > 0 ? `<div class="total">Spolu za suroviny: ${esc(totalPrice.toFixed(2))} €</div>` : ''}`
          : '<div class="empty">Zatiaľ žiadne suroviny.</div>'
      }

      <h2>Postup varenia</h2>
      ${
        processSteps.length
          ? `<table>
              <thead><tr><th>Proces</th><th>Čas od</th><th>Čas do</th><th>Teplota</th><th>Kotol</th><th>Poznámka</th></tr></thead>
              <tbody>${processRows}</tbody>
            </table>`
          : '<div class="empty">Zatiaľ žiadne kroky postupu.</div>'
      }
    </body>
    </html>
  `;
}
