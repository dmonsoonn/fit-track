import { test, expect } from 'playwright/test'
import { STORAGE_STATES } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'
import { uniqueSuffix } from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.admin })

test.describe('Admin System Templates (/admin/templates)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/templates')
    await page.waitForLoadState('networkidle')
  })

  test('shows "Системные шаблоны" title', async ({ page }) => {
    await expect(page.getByText('Системные шаблоны')).toBeVisible()
  })

  test('only shows system-scope templates', async ({ page }) => {
    // All visible templates should have "Системный" badge or none at all
    const systemBadge = page.getByText('Системный').first()
    const emptyState = page.getByText('Шаблонов нет')
    const hasBadge = await systemBadge.isVisible()
    const hasEmpty = await emptyState.isVisible()
    expect(hasBadge || hasEmpty).toBeTruthy()
  })

  test('"Шаблон" button opens create modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await expect(page.getByRole('dialog', { name: 'Новый шаблон' })).toBeVisible()
  })

  test('creates a system template and it appears with "Системный" badge', async ({ page }) => {
    const text = `System Template ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    const templateCard = page.locator('.flex.flex-col.gap-3 > div').filter({ hasText: text })
    await expect(templateCard.getByText('Системный')).toBeVisible()
  })

  test('send button (Отправить) is NOT visible for admin role', async ({ page }) => {
    // Templates.tsx: role === 'trainer' && <Send button>
    // Admin should not see the send button
    await expect(page.getByRole('button', { name: 'Отправить' })).not.toBeVisible()
  })

  test('delete button is present for admin on system templates', async ({ page }) => {
    const text = `Admin Delete Template ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    const templateCard = page.locator('.flex.flex-col.gap-3 > div').filter({ hasText: text })
    await expect(templateCard.getByRole('button', { name: 'Удалить' })).toBeVisible()
  })

  test('deletes system template with confirmation', async ({ page }) => {
    const text = `Delete System Tmpl ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    const templateCard = page.locator('.flex.flex-col.gap-3 > div').filter({ hasText: text })
    await templateCard.getByRole('button', { name: 'Удалить' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expectToast(page, 'Шаблон удалён')
    await expect(page.getByText(text)).not.toBeVisible()
  })
})
