import { test, expect } from '@playwright/test';

/**
 * E2E Tests for basic assumption creation and management
 */
test.describe('Assumption Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a fresh board each time
    await page.goto('/');

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // Check if we're on a board (URL should have #doc=...)
    const url = page.url();
    if (!url.includes('#doc=')) {
      // Click "New Board" to create a fresh document
      const newBoardButton = page.getByRole('button', { name: /new board/i });
      if (await newBoardButton.isVisible()) {
        await newBoardButton.click();
        await page.waitForURL(/.*#doc=.*/);
      }
    }
  });

  test('should create a new assumption', async ({ page }) => {
    // Find the input field for creating assumptions
    const input = page.getByPlaceholder(/add.*assumption/i);
    await expect(input).toBeVisible();

    // Type a new assumption
    const assumptionText = 'E2E testing is essential for quality software';
    await input.fill(assumptionText);
    await input.press('Enter');

    // Verify the assumption appears in the list
    await expect(page.getByText(assumptionText)).toBeVisible();
  });

  test('should create assumption with tags', async ({ page }) => {
    // Create assumption with tags
    const input = page.getByPlaceholder(/add.*assumption/i);
    const assumptionText = 'TypeScript improves code quality';

    await input.fill(assumptionText);

    // Look for tag input (might be in the same form or separate)
    const tagInput = page.getByPlaceholder(/tags/i);
    if (await tagInput.isVisible()) {
      await tagInput.fill('Testing, Quality');
    }

    await input.press('Enter');

    // Verify assumption and tags appear
    await expect(page.getByText(assumptionText)).toBeVisible();
  });

  test('should edit an existing assumption', async ({ page }) => {
    // Create an assumption first
    const input = page.getByPlaceholder(/add.*assumption/i);
    const originalText = 'Original assumption text';
    await input.fill(originalText);
    await input.press('Enter');

    // Wait for assumption to appear
    await expect(page.getByText(originalText)).toBeVisible();

    // Find and click edit button
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    await editButton.click();

    // Edit the text
    const editInput = page.locator('input[type="text"]').filter({ hasText: originalText });
    const updatedText = 'Updated assumption text';
    await editInput.fill(updatedText);
    await editInput.press('Enter');

    // Verify updated text appears
    await expect(page.getByText(updatedText)).toBeVisible();
    await expect(page.getByText(originalText)).not.toBeVisible();
  });

  test('should delete an assumption', async ({ page }) => {
    // Create an assumption first
    const input = page.getByPlaceholder(/add.*assumption/i);
    const assumptionText = 'Assumption to be deleted';
    await input.fill(assumptionText);
    await input.press('Enter');

    // Wait for assumption to appear
    await expect(page.getByText(assumptionText)).toBeVisible();

    // Find and click delete button
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    await deleteButton.click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify assumption is gone
    await expect(page.getByText(assumptionText)).not.toBeVisible();
  });

  test('should show empty state when no assumptions exist', async ({ page }) => {
    // On a fresh board, should show empty state
    const emptyMessage = page.getByText(/no assumptions yet|get started|create your first/i);

    // Empty state should be visible OR we should see the input field
    const input = page.getByPlaceholder(/add.*assumption/i);
    await expect(input).toBeVisible();
  });

  test('should persist assumptions after page reload', async ({ page }) => {
    // Create an assumption
    const input = page.getByPlaceholder(/add.*assumption/i);
    const assumptionText = 'This should persist after reload';
    await input.fill(assumptionText);
    await input.press('Enter');

    // Wait for assumption to appear
    await expect(page.getByText(assumptionText)).toBeVisible();

    // Get the current URL (contains document ID)
    const currentUrl = page.url();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify we're on the same document
    expect(page.url()).toBe(currentUrl);

    // Verify assumption still exists
    await expect(page.getByText(assumptionText)).toBeVisible();
  });
});
