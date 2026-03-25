import { expect, test } from "@playwright/test";

test("creates a session and auto-generates title after first message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 세션 시작" }).click();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.locator('input[value="Untitled"]')).toBeVisible();

  await page.getByPlaceholder("메시지를 입력하세요...").fill("창업을 한다면 무엇부터 해야 하나?");
  await page.getByRole("button", { name: "보내기" }).click();

  await expect(page.locator('input[value="창업을 한다면 무엇부터 해야 하나?"]')).toBeVisible();

  await page.locator('input[value="창업을 한다면 무엇부터 해야 하나?"]').fill("창업 첫 단추");
  await page.keyboard.press("Enter");

  await expect(page.locator('input[value="창업 첫 단추"]')).toBeVisible();
});
