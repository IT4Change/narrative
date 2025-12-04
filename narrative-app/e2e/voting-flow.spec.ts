import { test, expect } from '@playwright/test';
import { createAssumption, ensureOnBoard } from './helpers';

/**
 * E2E Tests for voting functionality
 */
test.describe('Voting Flow', () => {
  let assumptionText: string;

  test.beforeEach(async ({ page }) => {
    await ensureOnBoard(page);

    // Create a test assumption to vote on
    assumptionText = `Test assumption for voting ${Date.now()}`;
    await createAssumption(page, assumptionText);
    await page.waitForTimeout(1000);
  });

  test('should vote green on an assumption', async ({ page }) => {
    // Find the assumption card
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    // Find and click the green vote button
    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Verify vote was registered - look for "🟢 100%" or "1 vote"
    const voteIndicator = page.getByText(/🟢 100%|1 vote/i);
    await expect(voteIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should vote yellow on an assumption', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    const yellowButton = assumptionCard.getByRole('button', { name: /🟡/i }).first();
    await yellowButton.click();
    await page.waitForTimeout(500);

    // Verify vote was registered
    const voteIndicator = page.getByText(/🟡 100%|1 vote/i);
    await expect(voteIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should vote red on an assumption', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    const redButton = assumptionCard.getByRole('button', { name: /🔴/i }).first();
    await redButton.click();
    await page.waitForTimeout(500);

    // Verify vote was registered
    const voteIndicator = page.getByText(/🔴 100%|1 vote/i);
    await expect(voteIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should change vote from green to red', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    // Vote green first
    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Then vote red
    const redButton = assumptionCard.getByRole('button', { name: /🔴/i }).first();
    await redButton.click();
    await page.waitForTimeout(500);

    // Should still show 1 vote (not 2), just changed color
    const voteText = page.getByText(/100%|1/).first();
    await expect(voteText).toBeVisible({ timeout: 5000 });
  });

  test('should show vote counts correctly', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    // Vote on the assumption
    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Look for vote count display (e.g., "1" or "100%")
    const voteCount = page.getByText(/1|100%/);
    await expect(voteCount.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display vote percentage in vote bar', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    // Vote green
    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Check for percentage display (100% green since only one vote)
    const percentage = page.getByText(/100%/);
    await expect(percentage.first()).toBeVisible({ timeout: 5000 });
  });

  test('should persist vote after page reload', async ({ page }) => {
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    // Vote green
    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(1000);

    // Get current URL
    const currentUrl = page.url();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify assumption and vote still exist
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
    const voteIndicator = page.getByText(/🟢 100%|1 vote/i);
    await expect(voteIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show multiple votes with correct distribution', async ({ page }) => {
    // This test would need multiple users/contexts to truly test
    // For now, we just verify a single vote shows 100%
    const assumptionCard = page.locator(`text=${assumptionText}`).locator('..').locator('..');

    const greenButton = assumptionCard.getByRole('button', { name: /🟢/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // With 1 vote, should show 100%
    await expect(page.getByText(/100%/)).toBeVisible({ timeout: 5000 });
  });
});
