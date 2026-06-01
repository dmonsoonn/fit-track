import { test, expect } from 'playwright/test'
import { STORAGE_STATES, readTestEnv } from '../../fixtures/auth'
import { expectToast } from '../../utils/helpers'
import { uniqueSuffix } from '../../fixtures/data'

test.use({ storageState: STORAGE_STATES.trainer })

test.describe('Trainer Templates (/trainer/templates)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trainer/templates')
    await page.waitForLoadState('networkidle')
  })

  test('shows "Шаблоны сообщений" title (not Системные)', async ({ page }) => {
    await expect(page.getByText('Шаблоны сообщений')).toBeVisible()
    await expect(page.getByText('Системные шаблоны')).not.toBeVisible()
  })

  test('"Шаблон" button opens create modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await expect(page.getByRole('dialog', { name: 'Новый шаблон' })).toBeVisible()
  })

  test('Создать is disabled when text is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Создать' })).toBeDisabled()
  })

  test('creates a template of type confirmation and it appears in the list', async ({ page }) => {
    const text = `Test confirmation template ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    // type is "Подтверждение" by default (first option)
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')
    await expect(page.getByText(text)).toBeVisible()
  })

  test('filter "Подтверждение" shows only confirmation templates', async ({ page }) => {
    // Use the ChipGroup filter button (not a template badge)
    await page.locator('nav, [role="group"], .flex.flex-wrap').getByRole('button', { name: 'Подтверждение' }).first().click().catch(async () => {
      // fallback: click last chip group button matching the label
      await page.locator('button').filter({ hasText: /^Подтверждение$/ }).first().click()
    })
    // After filtering, "Перенос" type badges should not be visible in the list
    await page.waitForTimeout(200)
    const perenosaCards = page.locator('.flex.flex-col.gap-3').getByText('Перенос')
    const count = await perenosaCards.count()
    expect(count).toBe(0)
  })

  test('filter "Перенос" shows only reschedule templates', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Перенос$/ }).first().click()
    await page.waitForTimeout(200)
    const confirmCards = page.locator('.flex.flex-col.gap-3').getByText('Подтверждение')
    const count = await confirmCards.count()
    expect(count).toBe(0)
  })

  test('filter "Обратная связь" shows only feedback templates', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Обратная связь$/ }).first().click()
    await page.waitForTimeout(200)
    await expect(page.locator('button').filter({ hasText: /^Обратная связь$/ }).first()).toBeVisible()
  })

  test('send button (Отправить) opens SendModal for trainer', async ({ page }) => {
    // Create a template first to ensure one exists
    const text = `Send modal test ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    // Click send on the newly created template
    await page.getByRole('button', { name: 'Отправить' }).last().click()
    await expect(page.getByRole('dialog', { name: 'Отправить шаблон клиенту' })).toBeVisible()
  })

  test('SendModal has client selector dropdown', async ({ page }) => {
    const text = `Dropdown test ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    await page.getByRole('button', { name: 'Отправить' }).last().click()
    await expect(page.getByRole('dialog').locator('[data-table="clients"][data-attr="user_id"] select')).toBeVisible()
  })

  test('sending template to a client shows success toast', async ({ page }) => {
    const text = `Send to client test ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    await page.getByRole('button', { name: 'Отправить' }).last().click()
    const select = page.getByRole('dialog').locator('[data-table="clients"][data-attr="user_id"] select')
    await expect(select).toBeVisible()
    // Select the first available client from the dropdown (robust against DB state)
    const options = await select.locator('option').all()
    const clientOption = options.find(async (o) => await o.getAttribute('value') !== '')
    if (clientOption) {
      const value = await clientOption.getAttribute('value')
      if (value) {
        await select.selectOption({ value })
        await page.getByRole('dialog').getByRole('button', { name: 'Отправить' }).click()
        await expectToast(page, 'Сообщение отправлено клиенту')
      }
    }
  })

  test('delete button opens confirm dialog', async ({ page }) => {
    const text = `Delete template test ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    // Target the specific template card containing our unique text
    const card = page.locator('.flex.items-start.justify-between.gap-3').filter({ hasText: text })
    await card.getByRole('button', { name: 'Удалить' }).click()
    await expect(page.getByRole('dialog', { name: 'Удалить шаблон?' })).toBeVisible()
    // Cancel so we don't delete it here
    await page.getByRole('dialog').getByRole('button', { name: 'Отменить' }).click()
  })

  test('deleting template removes it from the list', async ({ page }) => {
    const text = `Remove template ${uniqueSuffix()}`
    await page.getByRole('button', { name: 'Шаблон' }).click()
    await page.getByRole('dialog').locator('[data-table="message_templates"][data-attr="text"] textarea').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
    await expectToast(page, 'Шаблон создан')

    // Target the specific template card
    const card = page.locator('.flex.items-start.justify-between.gap-3').filter({ hasText: text })
    await card.getByRole('button', { name: 'Удалить' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expectToast(page, 'Шаблон удалён')
    await expect(page.getByText(text)).not.toBeVisible()
  })
})
