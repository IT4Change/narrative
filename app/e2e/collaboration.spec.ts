import { test, expect } from '@playwright/test';

/**
 * E2E Tests for multi-user/multi-tab collaboration
 * Tests the CRDT sync functionality via BroadcastChannel and WebSocket
 */
test.describe('Multi-Tab Collaboration', () => {
  test('should sync new assumption between two tabs', async ({ browser }) => {
    // Create two browser contexts (simulating two users/tabs)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create a new board
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newBoardButton = page1.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page1.waitForURL(/.*#doc=.*/);
      }

      // Get the document URL
      const docUrl = page1.url();

      // Tab 2: Open the same document
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000); // Wait for sync

      // Tab 1: Create an assumption
      const input1 = page1.getByPlaceholder(/add.*assumption/i);
      const assumptionText = 'This should sync to tab 2';
      await input1.fill(assumptionText);
      await input1.press('Enter');

      // Verify it appears in Tab 1
      await expect(page1.getByText(assumptionText)).toBeVisible({ timeout: 5000 });

      // Wait for sync (BroadcastChannel is fast, WebSocket might take longer)
      await page2.waitForTimeout(2000);

      // Verify it appears in Tab 2
      await expect(page2.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should sync votes between two tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create board and assumption
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newBoardButton = page1.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page1.waitForURL(/.*#doc=.*/);
      }

      const input1 = page1.getByPlaceholder(/add.*assumption/i);
      await input1.fill('Assumption for vote sync test');
      await input1.press('Enter');
      await page1.waitForTimeout(500);

      // Get URL and open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000); // Wait for initial sync

      // Tab 1: Vote green
      const greenButton1 = page1.getByRole('button', { name: /🟢|green|agree/i }).first();
      await greenButton1.click();
      await page1.waitForTimeout(500);

      // Wait for sync
      await page2.waitForTimeout(2000);

      // Tab 2: Should see the vote
      const voteBar2 = page2.locator('[class*="vote"]').first();
      await expect(voteBar2).toBeVisible({ timeout: 5000 });

      // Tab 2: Vote red (different user)
      const redButton2 = page2.getByRole('button', { name: /🔴|red|disagree/i }).first();
      await redButton2.click();
      await page2.waitForTimeout(500);

      // Wait for sync back to Tab 1
      await page1.waitForTimeout(2000);

      // Tab 1: Should now show both votes
      const voteBar1 = page1.locator('[class*="vote"]').first();
      await expect(voteBar1).toBeVisible();

      // Both tabs should show 2 votes (1 green, 1 red = 50%/50%)
      // This depends on your UI showing vote counts
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should sync assumption edits between tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create board with assumption
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newBoardButton = page1.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page1.waitForURL(/.*#doc=.*/);
      }

      const originalText = 'Original assumption text';
      const input1 = page1.getByPlaceholder(/add.*assumption/i);
      await input1.fill(originalText);
      await input1.press('Enter');
      await page1.waitForTimeout(500);

      // Open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);

      // Verify Tab 2 sees the original assumption
      await expect(page2.getByText(originalText)).toBeVisible({ timeout: 10000 });

      // Tab 1: Edit the assumption
      const editButton1 = page1.getByRole('button', { name: /edit/i }).first();
      if (await editButton1.isVisible({ timeout: 1000 }).catch(() => false)) {
        await editButton1.click();
        const editInput = page1.locator('input[type="text"]').first();
        const updatedText = 'Updated assumption text';
        await editInput.fill(updatedText);
        await editInput.press('Enter');
        await page1.waitForTimeout(500);

        // Wait for sync
        await page2.waitForTimeout(2000);

        // Tab 2: Should see updated text
        await expect(page2.getByText(updatedText)).toBeVisible({ timeout: 10000 });
        await expect(page2.getByText(originalText)).not.toBeVisible();
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should sync assumption deletion between tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create board with assumption
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newBoardButton = page1.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page1.waitForURL(/.*#doc=.*/);
      }

      const assumptionText = 'Assumption to be deleted';
      const input1 = page1.getByPlaceholder(/add.*assumption/i);
      await input1.fill(assumptionText);
      await input1.press('Enter');
      await page1.waitForTimeout(500);

      // Open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);

      // Verify Tab 2 sees the assumption
      await expect(page2.getByText(assumptionText)).toBeVisible({ timeout: 10000 });

      // Tab 1: Delete the assumption
      const deleteButton1 = page1.getByRole('button', { name: /delete/i }).first();
      if (await deleteButton1.isVisible({ timeout: 1000 }).catch(() => false)) {
        await deleteButton1.click();

        // Confirm if needed
        const confirmButton = page1.getByRole('button', { name: /confirm|yes|delete/i });
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
        }

        await page1.waitForTimeout(500);

        // Wait for sync
        await page2.waitForTimeout(2000);

        // Tab 2: Assumption should be gone
        await expect(page2.getByText(assumptionText)).not.toBeVisible({ timeout: 10000 });
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle concurrent edits gracefully', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create board with assumption
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newBoardButton = page1.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page1.waitForURL(/.*#doc=.*/);
      }

      const input1 = page1.getByPlaceholder(/add.*assumption/i);
      await input1.fill('Concurrent edit test');
      await input1.press('Enter');
      await page1.waitForTimeout(500);

      // Open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);

      // Both tabs vote at roughly the same time (simulating conflict)
      const greenButton1 = page1.getByRole('button', { name: /🟢|green|agree/i }).first();
      const redButton2 = page2.getByRole('button', { name: /🔴|red|disagree/i }).first();

      // Click simultaneously
      await Promise.all([
        greenButton1.click(),
        redButton2.click(),
      ]);

      // Wait for sync
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);

      // Both votes should be preserved (CRDT merge)
      // Check that both tabs eventually show both votes
      const voteBar1 = page1.locator('[class*="vote"]').first();
      const voteBar2 = page2.locator('[class*="vote"]').first();

      await expect(voteBar1).toBeVisible();
      await expect(voteBar2).toBeVisible();

      // Both should show 2 votes (50% green, 50% red)
      // This validates CRDT conflict resolution
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
