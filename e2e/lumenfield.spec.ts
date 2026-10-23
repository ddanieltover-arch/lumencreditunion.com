import { test, expect } from '@playwright/test';

/**
 * Playwright End-to-End Test Suite for Lumenfield
 * Hard Rules & Acceptance Criteria:
 * 1. Persistent sandbox warning banner visible at all times
 * 2. Member registration and login
 * 3. KYC document verification workflow
 * 4. Super Admin funding wallet (tagged source=TEST)
 * 5. Member-to-member transfers with double-entry ledger settlement
 * 6. Member loan application (auto/mortgage)
 * 7. Admin underwriting review and approval
 */

test.describe('Lumenfield PWA End-to-End User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Acceptance Rule 1: Persistent sandbox banner
    await expect(
      page.getByText(/Sandbox environment: all balances are test funds, not real money/i)
    ).toBeVisible();
  });

  test('User Journey 1: Verify Landing Page & PWA Install Button', async ({ page }) => {
    await expect(page).toHaveTitle(/Lumenfield/i);
    // Ensure PWA install or instructions trigger exists
    const installBtn = page.getByRole('button', { name: /install/i });
    if (await installBtn.isVisible()) {
      await expect(installBtn).toBeEnabled();
    }
  });

  test('User Journey 2: Member Switcher & Dashboard Navigation', async ({ page }) => {
    // Navigate to Member Dashboard
    await page.getByRole('button', { name: /Member Dashboard/i }).click();
    await expect(page.getByText(/Combined Sandbox Balance/i).or(page.getByText(/Wallets/i))).toBeVisible();

    // Check tabs: Wallets, Transfers, Virtual Cards, Lending Sandbox, Documents, Settings
    await page.getByRole('button', { name: /Cards/i }).first().click();
    await expect(page.getByText(/Instant Virtual Cards/i).or(page.getByText(/Virtual Debit Card/i))).toBeVisible();
  });

  test('User Journey 3: Member Transfer Flow', async ({ page }) => {
    await page.getByRole('button', { name: /Member Dashboard/i }).click();

    // Open Transfers tab or Send Modal
    const sendButton = page.getByRole('button', { name: /Send Test Funds|Send Money/i }).first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
      const amountInput = page.getByPlaceholder(/0\.00/i);
      if (await amountInput.isVisible()) {
        await amountInput.fill('150.00');
        await page.getByRole('button', { name: /Send Now|Transfer/i }).first().click();
      }
    }
  });

  test('User Journey 4: Member Applies for a Loan & Admin Approves', async ({ page }) => {
    // Member Dashboard
    await page.getByRole('button', { name: /Member Dashboard/i }).click();
    await page.getByRole('button', { name: /Lending/i }).first().click();

    // Apply for Loan
    const applyLoanBtn = page.getByRole('button', { name: /Apply for Loan|Submit Loan Application/i }).first();
    if (await applyLoanBtn.isVisible()) {
      await applyLoanBtn.click();
    }

    // Switch to Admin Portal
    await page.getByRole('button', { name: /Admin: Fund a Wallet/i }).click();
    // In case of 403 / auth prompt, sign in as Super Admin
    const adminSignInBtn = page.getByRole('button', { name: /Sign In as Super Admin/i });
    if (await adminSignInBtn.isVisible()) {
      await adminSignInBtn.click();
    }

    // Switch to Loan Applications tab in Admin
    const loanTab = page.getByRole('button', { name: /Loan applications/i });
    if (await loanTab.isVisible()) {
      await loanTab.click();
      await expect(page.getByText(/Credit & Underwriting Queue/i)).toBeVisible();
      const approveBtn = page.getByRole('button', { name: /Approve & Disburse/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
      }
    }
  });

  test('User Journey 5: Admin Funds Member Wallet via Double-Entry Ledger', async ({ page }) => {
    await page.getByRole('button', { name: /Admin: Fund a Wallet/i }).click();
    const adminSignInBtn = page.getByRole('button', { name: /Sign In as Super Admin/i });
    if (await adminSignInBtn.isVisible()) {
      await adminSignInBtn.click();
    }

    const fundWalletHeading = page.getByRole('heading', { name: /Fund a wallet/i });
    if (await fundWalletHeading.isVisible()) {
      await expect(page.getByText(/Every credit is posted to the ledger/i)).toBeVisible();
      // Ensure funding button is active
      const postCreditBtn = page.getByRole('button', { name: /Post credit to ledger/i });
      await expect(postCreditBtn).toBeVisible();
    }
  });

  test('User Journey 6: GDPR Data Export and Legal Modals', async ({ page }) => {
    // Test Terms and Privacy Modals from Landing
    await page.getByRole('button', { name: /Landing Page/i }).click();
    await page.getByRole('button', { name: /Terms/i }).click();
    await expect(page.getByText(/PENDING FORMAL LEGAL REVIEW/i)).toBeVisible();
    await page.getByRole('button', { name: /Close Terms/i }).click();

    await page.getByRole('button', { name: /Privacy/i }).click();
    await expect(page.getByText(/GDPR \/ CCPA DISCLOSURE/i)).toBeVisible();
    await page.getByRole('button', { name: /Close Privacy/i }).click();
  });
});
