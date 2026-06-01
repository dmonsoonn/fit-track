import type { Page } from 'playwright/test'
import { expect } from 'playwright/test'

/** Fill a <Field table="X" attr="Y"><Input /></Field> */
export async function fillField(page: Page, table: string, attr: string, value: string) {
  await page.locator(`[data-table="${table}"][data-attr="${attr}"] input`).fill(value)
}

/** Fill a <Field table="X" attr="Y"><Textarea /></Field> */
export async function fillTextarea(page: Page, table: string, attr: string, value: string) {
  await page.locator(`[data-table="${table}"][data-attr="${attr}"] textarea`).fill(value)
}

/** Clear and re-fill a field (for update tests). */
export async function clearAndFill(page: Page, table: string, attr: string, value: string) {
  const loc = page.locator(`[data-table="${table}"][data-attr="${attr}"] input`)
  await loc.clear()
  await loc.fill(value)
}

/** Wait for a toast notification. Toaster renders in .fixed.bottom-6.right-4 */
export async function expectToast(page: Page, text: string, timeout = 5000) {
  await expect(
    page.locator('.fixed.bottom-6').getByText(text),
  ).toBeVisible({ timeout })
}

/** Wait for a modal dialog with the given aria-label / title. */
export async function expectModal(page: Page, title: string) {
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
}

/** Press Escape or click the X close button inside the open modal. */
export async function closeModal(page: Page) {
  await page.keyboard.press('Escape')
}

/** Click the confirm button inside a ConfirmDialog (default label "Подтвердить"). */
export async function confirmDialog(page: Page, label = 'Подтвердить') {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: label }).click()
}

/** Click cancel inside a ConfirmDialog. */
export async function cancelDialog(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Отменить' }).click()
}

/** Assert the current page URL matches a path or pattern. */
export async function expectPath(page: Page, pattern: string | RegExp) {
  await expect(page).toHaveURL(pattern)
}

/** Today's date as YYYY-MM-DD. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
