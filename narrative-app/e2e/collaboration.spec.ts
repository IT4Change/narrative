import { test, expect } from '@playwright/test';
import { createAssumption } from './helpers';

/**
 * E2E Tests for multi-user/multi-tab collaboration
 * Tests the CRDT sync functionality
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

      const newButton = page1.getByRole('button', { name: /^new$/i });
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();
        await page1.waitForURL(/.*#doc=.*/);
        await page1.waitForTimeout(1000);
      }

      // Get the document URL
      const docUrl = page1.url();

      // Tab 2: Open the same document
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000); // Wait for sync

      // Tab 1: Create an assumption
      const assumptionText = 'This should sync to tab 2';
      await createAssumption(page1, assumptionText);

      // Wait for sync
      await page2.waitForTimeout(3000);

      // Verify it appears in Tab 2
      await expect(page2.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should show assumptions from both users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Tab 1: Create board
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newButton = page1.getByRole('button', { name: /^new$/i });
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();
        await page1.waitForURL(/.*#doc=.*/);
        await page1.waitForTimeout(1000);
      }

      await createAssumption(page1, 'Assumption from user 1');

      // Get URL and open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);

      // Tab 2: Should see user 1's assumption
      await expect(page2.getByText('Assumption from user 1')).toBeVisible({ timeout: 10000 });

      // Tab 2: Create own assumption
      await createAssumption(page2, 'Assumption from user 2');

      // Wait for sync back to Tab 1
      await page1.waitForTimeout(3000);

      // Tab 1: Should now see both
      await expect(page1.getByText('Assumption from user 1')).toBeVisible();
      await expect(page1.getByText('Assumption from user 2')).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle concurrent assumption creation', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup: Create board and open in both tabs
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');

      const newButton = page1.getByRole('button', { name: /^new$/i });
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();
        await page1.waitForURL(/.*#doc=.*/);
        await page1.waitForTimeout(1000);
      }

      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);

      // Both tabs create assumptions at roughly the same time
      await Promise.all([
        createAssumption(page1, 'Concurrent assumption 1'),
        createAssumption(page2, 'Concurrent assumption 2'),
      ]);

      // Wait for sync
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);

      // Both assumptions should be preserved (CRDT merge)
      // Check both tabs show both assumptions
      await expect(page1.getByText('Concurrent assumption 1')).toBeVisible({ timeout: 10000 });
      await expect(page1.getByText('Concurrent assumption 2')).toBeVisible({ timeout: 10000 });

      await expect(page2.getByText('Concurrent assumption 1')).toBeVisible({ timeout: 10000 });
      await expect(page2.getByText('Concurrent assumption 2')).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
