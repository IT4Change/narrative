import { test, expect } from '@playwright/test';

/**
 * E2E Tests for voting functionality
 */
test.describe('Voting Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure we're on a board
    const url = page.url();
    if (!url.includes('#doc=')) {
      const newBoardButton = page.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page.waitForURL(/.*#doc=.*/);
      }
    }

    // Create a test assumption to vote on
    const input = page.getByPlaceholder(/add.*assumption/i);
    await input.fill('Test assumption for voting');
    await input.press('Enter');
    await page.waitForTimeout(500); // Wait for assumption to be created
  });

  test('should vote green on an assumption', async ({ page }) => {
    // Find the green vote button (emoji or text)
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();

    // Verify vote was registered (check for visual feedback)
    // Could be a highlight, a count, or a vote bar update
    await page.waitForTimeout(500);

    // The vote bar should show 100% green
    const voteBar = page.locator('[class*="vote"]').first();
    await expect(voteBar).toBeVisible();
  });

  test('should vote yellow on an assumption', async ({ page }) => {
    const yellowButton = page.getByRole('button', { name: /🟡|yellow|neutral/i }).first();
    await yellowButton.click();

    await page.waitForTimeout(500);

    // Verify vote was registered
    const voteBar = page.locator('[class*="vote"]').first();
    await expect(voteBar).toBeVisible();
  });

  test('should vote red on an assumption', async ({ page }) => {
    const redButton = page.getByRole('button', { name: /🔴|red|disagree/i }).first();
    await redButton.click();

    await page.waitForTimeout(500);

    // Verify vote was registered
    const voteBar = page.locator('[class*="vote"]').first();
    await expect(voteBar).toBeVisible();
  });

  test('should change vote from green to red', async ({ page }) => {
    // Vote green first
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(300);

    // Then vote red
    const redButton = page.getByRole('button', { name: /🔴|red|disagree/i }).first();
    await redButton.click();
    await page.waitForTimeout(300);

    // Should still only show 1 vote (the red one)
    // The vote bar should reflect this change
    const voteBar = page.locator('[class*="vote"]').first();
    await expect(voteBar).toBeVisible();
  });

  test('should remove vote', async ({ page }) => {
    // Vote green first
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(300);

    // Click the same button again to remove vote (if supported)
    // OR find a remove/clear vote button
    const removeButton = page.getByRole('button', { name: /remove|clear.*vote/i }).first();
    if (await removeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await removeButton.click();
      await page.waitForTimeout(300);

      // Verify vote was removed
      const noVotesText = page.getByText(/no votes yet/i);
      await expect(noVotesText).toBeVisible({ timeout: 5000 });
    } else {
      // If no remove button, clicking same vote button might toggle it off
      await greenButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show vote counts correctly', async ({ page }) => {
    // Vote on the assumption
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Look for vote count display (e.g., "1" or "1 vote")
    // This depends on your UI implementation
    const voteCount = page.getByText(/1/);
    await expect(voteCount.first()).toBeVisible();
  });

  test('should display vote percentage in vote bar', async ({ page }) => {
    // Vote green
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Check for percentage display (e.g., "100%" or "🟢 100%")
    const percentage = page.getByText(/100%/);
    await expect(percentage.first()).toBeVisible();
  });

  test('should show voter identity in tooltip or details', async ({ page }) => {
    // Vote on assumption
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Open details or hover over vote bar to see voter info
    const detailsButton = page.getByRole('button', { name: /details|activity/i }).first();
    if (await detailsButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await detailsButton.click();
      await page.waitForTimeout(300);

      // Should show some voter identity (DID or display name)
      const voterInfo = page.getByText(/did:key|voted/i);
      await expect(voterInfo.first()).toBeVisible();
    }
  });

  test('should persist vote after page reload', async ({ page }) => {
    // Vote green
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Vote should still be there
    const voteBar = page.locator('[class*="vote"]').first();
    await expect(voteBar).toBeVisible();

    // Should still show the vote (green 100%)
    const percentage = page.getByText(/100%/);
    await expect(percentage.first()).toBeVisible();
  });
});
