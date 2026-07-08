# TEMU Login Automation

## Scope

This module handles automatic relogin for:

- `https://seller.kuajingmaihuo.com/settle/seller-login`
- `https://seller.kuajingmaihuo.com/settle/activity-login`
- `https://seller.kuajingmaihuo.com/login`
- `https://agentseller.temu.com/main/authentication`

## Stability Rules

The automation uses a strict fallback order:

1. Detect the React-controlled account component and update `phone` and `areaCode` through its `onChange`.
2. Detect the React-controlled password component and update it through its `onChange`.
3. Confirm the rendered DOM value matches the target value.
4. Activate the password input before filling so the page enters the correct interactive state.
5. After password and agreement are ready, wait for a short submit warmup window before clicking login.
6. Only if React state control is not enough, fall back to DOM assignment, sequential text insertion, and UI clicking.
7. Never submit the login button unless account, password, agreement state, and region state are all confirmed.

This is intentional. The login page is React-controlled, so direct DOM writes alone are not reliable enough.

## Account Login Card

The newer seller-center login page at `/login` may first land on a card-style mode selector. The automation now:

1. Detects whether the page is the `/login` seller login route.
2. Searches visible tabs or buttons for labels like `account login`, `account password login`, `password login`, or the equivalent Chinese wording.
3. Clicks the account-login card first.
4. Waits for the phone and password inputs to render before continuing autofill.
5. Penalizes wrapper containers that contain both scan-login and account-login text so the click lands on the real account tab item.

If the card switch still does not settle after repeated retries, the runtime debug snapshot now records the visible login-mode buttons for diagnosis.

## Agreement And Verification Guardrails

For the `/login` seller-center page, the automation now also:

1. Avoids treating static help text such as `Unable to receive verification code` as an active OTP or captcha challenge.
2. Searches the agreement row for standard checkboxes, ARIA checkboxes, or custom clickable checkbox-like elements near the consent text.
3. Re-checks agreement state after each click before proceeding to submit.

## Region Switching

For Hong Kong shops, the preferred strategy is:

1. Set account component `areaCode` to `852` directly through React state.
2. Verify that the component state or visible region text changed to Hong Kong.
3. Only if state update does not take effect, open the dropdown and click the visible Hong Kong option.
4. If UI click still fails, use keyboard fallback.

## Seller Center Re-entry

For seller center session expiry, the flow now returns to the native `agentseller` authentication page first, then clicks the seller-center entry in-page. This avoids forcing a direct jump to `settle/seller-login` too early.

## Seller Center Landing

When login completes and the browser lands on `https://seller.kuajingmaihuo.com/settle/site-main`, the automation now:

1. Checks the visible current shop against the configured shop name.
2. If the shop does not match, clicks `switch` / `切换` and tries to pick the configured shop.
3. If no matching shop can be switched to, stops the automatic flow and shows a persistent message.
4. If the page shows an authorization agreement row, checks it before continuing.
5. If Seller Central shows the authorization dialog before entering Global, checks the privacy-policy agreement and clicks the confirm authorization button.
6. Clicks the `全球` card's `进入` button after the shop and agreement state are ready.

## Runtime Logs

Important runtime log events:

- `shop_login_autofill_injected`
- `shop_login_page_debug_snapshot`
- `shop_login_automation_phase_changed`
- `shop_seller_center_site_main_automation`

The debug snapshot records:

- visible inputs
- visible buttons
- visible login-mode buttons and tabs
- username and password DOM
- current body text preview
- current URL and document state

Runtime log path:

- `C:\\Users\\wykz8\\AppData\\Roaming\\temu-toolbox-electron\\TEMU_Data_Electron\\local_state\\runtime_logs\\electron-runtime.log`

## Expected Manual Takeover Cases

Automation should stop and ask for manual handling when:

- OTP or SMS verification appears
- the page locks the account and password inputs and shows a verification code input after submit
- slider / captcha appears
- page structure changes enough that inputs or buttons cannot be confirmed
- account and browser session are mismatched

## Main Files

- `src/windows/shopWindowLoginAutofill.js`
- `src/windows/shopWindowBrowserController.js`
- `src/windows/shopWindowSellerSessionProbe.js`
