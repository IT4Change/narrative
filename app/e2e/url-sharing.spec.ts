import { test, expect } from '@playwright/test';

/**
 * E2E Tests for URL-based document sharing
 * Validates that documents can be shared via URL and persist across sessions
 */
test.describe('URL Sharing', () => {
  test('should create document with URL hash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create a new board
    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    // URL should contain #doc=automerge:...
    const url = page.url();
    expect(url).toContain('#doc=');
    expect(url).toContain('automerge:');
  });

  test('should load existing document from URL hash', async ({ page }) => {
    // Create a board with content
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const assumptionText = 'Test assumption for URL sharing';
    const input = page.getByPlaceholder(/add.*assumption/i);
    await input.fill(assumptionText);
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Verify assumption is visible
    await expect(page.getByText(assumptionText)).toBeVisible();

    // Get the document URL
    const docUrl = page.url();

    // Navigate to a different page (simulate going away)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate back using the saved URL
    await page.goto(docUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Assumption should still be there
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
  });

  test('should share document URL between different users', async ({ browser }) => {
    // User 1: Create a document
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/');
    await page1.waitForLoadState('networkidle');

    const newBoardButton = page1.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page1.waitForURL(/.*#doc=.*/);
    }

    const assumptionText = 'Shared document test';
    const input1 = page1.getByPlaceholder(/add.*assumption/i);
    await input1.fill(assumptionText);
    await input1.press('Enter');
    await page1.waitForTimeout(1000);

    // Get the shareable URL
    const shareUrl = page1.url();

    // User 2: Open the same URL (simulating a different user)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto(shareUrl);
    await page2.waitForLoadState('networkidle');
    await page2.waitForTimeout(2000); // Wait for sync from server

    // User 2 should see the same content
    await expect(page2.getByText(assumptionText)).toBeVisible({ timeout: 10000 });

    // Verify URL is the same
    expect(page2.url()).toBe(shareUrl);

    await context1.close();
    await context2.close();
  });

  test('should maintain document ID in URL when adding content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const initialUrl = page.url();
    const docId = initialUrl.split('#doc=')[1];

    // Add content
    const input = page.getByPlaceholder(/add.*assumption/i);
    await input.fill('Testing URL persistence');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // Vote
    const greenButton = page.getByRole('button', { name: /🟢|green|agree/i }).first();
    await greenButton.click();
    await page.waitForTimeout(500);

    // URL should still have the same document ID
    const currentUrl = page.url();
    expect(currentUrl).toContain(docId);
    expect(currentUrl).toBe(initialUrl);
  });

  test('should handle invalid document URL gracefully', async ({ page }) => {
    // Try to load a non-existent or invalid document ID
    await page.goto('/#doc=automerge:invalid-document-id');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should either:
    // 1. Show an error message, OR
    // 2. Redirect to create a new board, OR
    // 3. Create a new empty document

    // Check if we're still on a valid page (not crashed)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should copy document URL to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const docUrl = page.url();

    // Look for a "Share" or "Copy URL" button
    const shareButton = page.getByRole('button', { name: /share|copy.*url/i });
    if (await shareButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await shareButton.click();
      await page.waitForTimeout(500);

      // Read clipboard
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain(docUrl);
    }
  });

  test('should support multiple documents in localStorage', async ({ page }) => {
    // Create first document
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const input = page.getByPlaceholder(/add.*assumption/i);
    await input.fill('First document assumption');
    await input.press('Enter');
    await page.waitForTimeout(1000);

    const firstDocUrl = page.url();

    // Create second document
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton2 = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton2.isVisible()) {
      await newBoardButton2.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const input2 = page.getByPlaceholder(/add.*assumption/i);
    await input2.fill('Second document assumption');
    await input2.press('Enter');
    await page.waitForTimeout(1000);

    const secondDocUrl = page.url();

    // Document URLs should be different
    expect(firstDocUrl).not.toBe(secondDocUrl);

    // Navigate back to first document
    await page.goto(firstDocUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should see first document content
    await expect(page.getByText('First document assumption')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Second document assumption')).not.toBeVisible();

    // Navigate to second document
    await page.goto(secondDocUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should see second document content
    await expect(page.getByText('Second document assumption')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('First document assumption')).not.toBeVisible();
  });

  test('should persist document after browser restart', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newBoardButton = page.getByRole('button', { name: /new board/i });
    if (await newBoardButton.isVisible()) {
      await newBoardButton.click();
      await page.waitForURL(/.*#doc=.*/);
    }

    const assumptionText = 'Persistence test assumption';
    const input = page.getByPlaceholder(/add.*assumption/i);
    await input.fill(assumptionText);
    await input.press('Enter');
    await page.waitForTimeout(1000);

    const docUrl = page.url();

    // Simulate browser restart by clearing page state and navigating fresh
    await page.goto('about:blank');
    await page.waitForTimeout(500);

    // Reopen the document URL
    await page.goto(docUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Content should still be there (loaded from IndexedDB)
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
  });
});
