# CODEX MASTER PROMPT
# Phone Second Shop POS — Complete Windows Desktop Application

You are a senior software architect, Electron developer, React/TypeScript engineer, database architect, UI/UX designer, security engineer, QA engineer, and Windows deployment engineer.

Build a complete, practical, production-oriented Windows desktop POS application for a second-hand mobile phone shop FROM SCRATCH.

This is a NEW PROJECT. Do not assume that existing source code or a database exists.

Your job is to work directly in the selected project workspace, create the actual files, implement real functionality, run available tests, fix errors, and build a Windows installer when the environment supports it.

Do not stop after writing a plan or displaying example code. Continue implementing the project in verifiable phases.

==================================================
1. PRODUCT GOALS
==================================================

Application name: Phone Second Shop POS
Application type: Windows Desktop POS
Primary platform: Windows 10/11 x64
Architecture: Electron + React + TypeScript
Frontend tooling: Vite
Database: SQLite
Packaging: Electron Builder
Default language: Burmese
Default currency: MMK
Primary operation mode: Offline-first

Supported languages:
- Burmese: my-MM
- Thai: th-TH
- English: en-US

Supported currencies:
- MMK: Myanmar Kyat
- THB: Thai Baht
- USD: US Dollar

The application must remain usable without an internet connection for local sales, stock management, customer records, repair jobs, and reporting.

Online features such as update checks must be optional and must never prevent core offline operation.

==================================================
2. REQUIRED DEVELOPMENT WORKFLOW
==================================================

Follow this workflow:

Inspect Environment
→ Define Architecture
→ Create Project
→ Configure Dependencies
→ Build Database
→ Implement Modules
→ Add Tests
→ Run Tests
→ Fix Errors
→ Build Windows Installer
→ Verify Installation Artifacts
→ Document Results

At the beginning:
1. Inspect the current workspace and available tools.
2. Check Node.js, npm, Git, operating system, and available build tooling.
3. Select compatible dependency versions.
4. Create a concise implementation plan and project checklist.
5. Start implementing the actual application immediately after the plan.

Do not stop at planning.

After each major phase:
- Run the relevant tests.
- Run TypeScript checks.
- Run the production build where practical.
- Fix real errors before continuing.
- Report test results honestly.
- Maintain a checklist of completed and pending features.

If a dependency fails to install, diagnose the real error and choose a compatible alternative instead of repeatedly running the same failing command.

Never claim that tests passed or an installer was created unless the commands actually succeeded.

==================================================
3. TECHNOLOGY AND ARCHITECTURE
==================================================

Use:
- Electron
- React
- TypeScript
- Vite
- SQLite
- Electron Builder
- A maintained SQLite driver compatible with the selected Electron and Node versions
- A consistent desktop UI component system
- Automated testing tools compatible with the selected stack

Architecture:
- Electron main process
- Restricted preload bridge
- React renderer
- Typed application services
- Database repository layer
- Business logic layer
- Localization layer
- Reporting and printing services
- Automated tests

Security:
- contextIsolation enabled.
- nodeIntegration disabled.
- sandbox renderer processes where compatible.
- Expose only explicit, validated IPC methods through preload.
- Never expose arbitrary SQL execution or unrestricted filesystem access to the renderer.
- Validate IPC input in the main process.
- Apply authorization checks to privileged operations.
- Never execute user-provided code.
- Avoid unnecessary native dependencies.
- Pin compatible dependencies and maintain a lockfile.

Keep application logic modular and maintainable.

==================================================
4. WINDOWS INSTALLATION AND DATA STORAGE
==================================================

Create:
- Development scripts.
- Production build scripts.
- Windows x64 installer.
- Optional portable executable.
- Application icon and metadata.
- Version information.
- Installation guide.
- Upgrade guide.
- Uninstallation guidance.

Store the SQLite database and user files in Electron's application user-data directory.

Never store the production database inside the temporary installation directory or a folder that an application update overwrites.

Uninstalling the application must not silently delete the user's business database or backups.

Use versioned migrations to update the database safely.

Support backup to a user-selected folder or drive.

Verify installer output and report the actual artifact paths.

If the current environment cannot create or test a Windows installer, finish the source implementation and provide exact commands to build and verify it on Windows. Clearly identify anything not tested.

==================================================
5. AUTHENTICATION AND USER MANAGEMENT
==================================================

Implement:
- First-run owner account setup.
- Login and logout.
- Password change.
- Owner and Admin roles.
- Cashier role.
- Stock Manager role.
- Technician role.
- Fine-grained permissions.
- Session management.
- Audit logging.
- Optional PIN confirmation for sensitive cashier operations.

Security:
- Hash passwords using a suitable password hashing algorithm.
- Never store plaintext passwords.
- Use rate limiting or increasing delays for repeated failed login attempts.
- Protect owner-only actions.
- Require confirmation for destructive operations.
- Do not create a production account with a hardcoded password.
- Provide a safe first-run setup process.

A local desktop application cannot provide strong protection against someone with full administrative access to the Windows computer. Document this limitation.

==================================================
6. DASHBOARD
==================================================

Display:
- Today's sales.
- Today's purchases.
- Today's expenses.
- Gross profit and net profit.
- Cash received.
- Outstanding customer balances.
- Supplier balances.
- Phone inventory count.
- Accessories inventory.
- Low-stock alerts.
- Repair jobs by status.
- Warranty alerts.
- Recent sales and purchases.
- Recent audit events.

Support date filters and a useful summary for daily, weekly, monthly, and custom periods.

Use real database queries. Do not populate production dashboard cards with fabricated statistics.

==================================================
7. SECOND-HAND PHONE INVENTORY
==================================================

Implement:
- Brand and model.
- Storage capacity.
- RAM.
- Color.
- Network and SIM details where relevant.
- New, used, and refurbished conditions.
- Grade A/B/C or configurable grades.
- Product photos.
- IMEI 1.
- IMEI 2.
- Serial number.
- Battery health.
- Screen condition.
- Camera condition.
- Face ID, fingerprint, and sensor inspection.
- Accessories included with the phone.
- Purchase date.
- Supplier or previous owner.
- Purchase price.
- Repair and refurbishment costs.
- Selling price.
- Minimum permitted selling price where configured.
- Stock status.
- Warranty type and dates.
- Internal notes.
- Barcode and QR support.

Track every physical phone as an individual unit.

Prevent duplicate active IMEIs and validate IMEI format where applicable. Support devices with missing or nonstandard identifiers through an explicitly approved alternative identifier workflow.

A sold device must not remain available for sale.

Track all stock movements.

Never silently overwrite the ownership or transaction history of an existing phone.

==================================================
8. USED-PHONE PURCHASING AND TRADE-IN
==================================================

Implement:
- Purchase from customer.
- Supplier purchase.
- Seller contact details.
- Phone inspection checklist.
- IMEI recording.
- Purchase agreement or receipt.
- Purchase cost.
- Inspection and refurbishment costs.
- Purchase payment method.
- Amount paid and outstanding balance.
- Trade-in during a new phone sale.
- Trade-in valuation.
- Difference payable by customer.
- Purchase cancellation and audited reversal.

Business rules:
- Track purchase cost separately from sale price.
- Include eligible refurbishment costs in the phone's cost basis.
- Prevent duplicate purchase submission.
- Use database transactions for purchase and stock changes.
- Do not erase historical records when a purchase is reversed.

==================================================
9. POS CHECKOUT
==================================================

Create a fast, keyboard-friendly checkout interface.

Features:
- Search by IMEI, model, product name, SKU, and barcode.
- Add and remove cart items.
- Scan supported barcode input.
- Sell individual phones.
- Sell accessories by quantity.
- Add repair services.
- Discounts with permission controls.
- Customer selection.
- Cash sale.
- Partial payment.
- Credit sale.
- Multiple recorded payment methods.
- Trade-in adjustment.
- Deposit and remaining balance.
- Invoice number.
- Receipt printing.
- Reprint previous invoices.
- Hold and resume carts if implemented safely.
- Return and refund workflow.
- Sales history.
- Cancellation with permission and audit log.

Supported payment record types:
- Cash.
- KBZPay.
- WavePay.
- AYA Pay.
- Bank transfer.
- Other configurable methods.

Recording a payment method is not equivalent to integrating with a payment provider. Do not claim that a mobile payment has been verified unless a genuine authorized integration exists.

Business rules:
- Prevent overselling.
- Prevent duplicate invoice creation from repeated button clicks.
- Validate prices and discounts on the backend service layer.
- Use atomic database transactions for sale, payment, and stock changes.
- Restore stock correctly when an approved return requires it.
- Keep credit sales separate from cash received.
- Never treat an unpaid amount as collected revenue in the cashbook.

==================================================
10. ACCESSORIES AND SPARE PARTS
==================================================

Implement:
- Chargers.
- Cables.
- Cases.
- Screen protectors.
- Earphones.
- Power banks.
- Batteries.
- Screens.
- Charging ports.
- Other configurable items.

Support:
- SKU.
- Barcode.
- Category.
- Supplier.
- Purchase cost.
- Retail price.
- Wholesale price if enabled.
- Quantity.
- Reorder level.
- Stock movements.
- Purchase orders or replenishment records.
- Stock adjustment with a reason and audit entry.

Do not allow stock to become negative unless a deliberately configured and permission-controlled business rule allows it.

==================================================
11. REPAIR CENTER
==================================================

Implement:
- Repair ticket number.
- Customer details.
- Device information.
- IMEI or alternate identifier.
- Reported problem.
- Initial inspection.
- Device condition and received accessories.
- Photos with customer permission.
- Technician assignment.
- Diagnosis.
- Estimated price.
- Customer approval.
- Deposit.
- Parts used.
- Labor cost.
- Repair status.
- Final bill.
- Payment status.
- Repair warranty.
- Delivery confirmation.
- Repair history.

Repair statuses:
Received
→ Diagnosing
→ Waiting for Approval
→ Waiting for Parts
→ Repairing
→ Ready for Collection
→ Delivered

Allow cancellation and reopening only through appropriate permission-controlled workflows.

Never require customers to disclose device PINs or passwords unnecessarily. Do not store sensitive device credentials as ordinary repair notes.

==================================================
12. CUSTOMERS AND SUPPLIERS
==================================================

Customers:
- Name.
- Phone number.
- Optional address.
- Purchase history.
- Trade-in history.
- Warranty history.
- Outstanding balance.
- Payment history.
- Notes.

Suppliers:
- Name.
- Contact details.
- Purchase history.
- Amount paid.
- Outstanding balance.
- Payment history.

Provide searchable tables, filters, pagination, and CSV export.

Collect only information necessary for business operations.

==================================================
13. WARRANTY, RETURNS, AND REFUNDS
==================================================

Implement:
- Configurable warranty periods.
- No-warranty sales.
- Manufacturer warranty records.
- Shop warranty.
- Repair warranty.
- Warranty claims.
- Warranty status and expiration.
- Return eligibility checks.
- Exchange workflows.
- Refund records.
- Partial refunds.
- Restocking decisions.
- Return reasons.
- Manager approval where required.

A returned phone must not automatically become sellable if its condition has not been inspected.

Use reversal or refund records instead of silently editing finalized transactions.

==================================================
14. FINANCE AND ACCOUNTING
==================================================

Implement:
- Cashbook.
- Cashier opening balance.
- Cash in and cash out.
- Daily cashier closing.
- Expenses.
- Customer receivables.
- Supplier payables.
- Payment collection.
- Supplier payments.
- Purchase ledger.
- Sales ledger.
- Transaction history.
- Reconciliation reports.

Profit calculations must distinguish:
- Sales revenue.
- Cost of goods sold.
- Phone refurbishment costs.
- Discounts.
- Refunds.
- Operating expenses.
- Gross profit.
- Net profit.

Document the accounting policy used.

Avoid double-counting purchase costs, repair expenses, refunds, and stock adjustments.

Use auditable entries for corrections.

==================================================
15. MULTI-LANGUAGE SUPPORT
==================================================

Support:
- Burmese: my-MM.
- Thai: th-TH.
- English: en-US.

Translate every user-facing string:
- Navigation.
- Buttons.
- Forms.
- Tables.
- Dialogs.
- Validation errors.
- Notifications.
- Reports.
- Settings.
- Receipts.
- About.
- Support.
- Bug reports.

Requirements:
- Language selector in the application header and Settings.
- Persist the selected language.
- Change language without restarting where practical.
- Preserve unsaved forms and cart contents.
- Use centralized translation dictionaries with stable keys.
- Bundle suitable fonts such as Noto Sans Myanmar and Noto Sans Thai where licensing and packaging permit.
- Verify Unicode display and printing.

Do not leave important pages in English only.

==================================================
16. OPERATING SYSTEM LOCALE DETECTION
==================================================

At first launch:
- Detect the available operating system locale.
- Detect the region and timezone where possible.
- Suggest a suitable default application language.
- Suggest the initial region and currency based on explicit locale-to-default mappings.

Do not assume the Windows display language, region, timezone, and currency are always the same.

Allow the owner to change application language, region, currency, date format, time format, number format, and timezone independently.

Persist user choices.

Do not overwrite saved POS preferences during later launches.

Provide:
- Use Windows Defaults.
- Reset POS Preferences with confirmation.

Changing POS preferences must not modify Windows settings.

==================================================
17. MULTI-CURRENCY SUPPORT
==================================================

Supported currencies:
- MMK.
- THB.
- USD.

Default currency for a new Myanmar shop: MMK.

Requirements:
- Format currency consistently across POS, receipts, reports, and exports.
- Keep the original currency code on every finalized transaction and payment.
- Never rewrite historical transactions when the default currency changes.
- Support authorized manual exchange-rate configuration.
- Store the applied rate, source, timestamp, and currency pair for conversions.
- Never invent exchange rates.
- Do not automatically convert a payment unless the conversion rate and rounding policy are explicitly defined.
- Clearly distinguish transaction currency from reporting currency.
- Keep all monetary arithmetic safe and deterministic.
- Prefer integer minor units where supported; for currencies without conventional minor units, document the currency-specific precision.
- Use a well-tested decimal or integer-money implementation instead of JavaScript floating-point arithmetic for financial calculations.

Test sales, returns, partial payments, refunds, and reports across supported currencies.

==================================================
18. NUMBER, DATE, AND TIME FORMATS
==================================================

Support:
- Western digits.
- Myanmar digits.
- Locale-aware dates.
- Locale-aware times.
- Configurable timezone.
- Configurable first day of week where useful.

Use explicit locale settings for formatting.

Store timestamps in a consistent machine-readable format and convert them for display.

Digit localization must not alter underlying numeric values.

==================================================
19. RECEIPTS AND PRINTING
==================================================

Implement:
- A4 invoice.
- 80mm thermal receipt.
- 58mm thermal receipt where supported.
- Store name and logo.
- Contact information.
- Invoice number.
- Date and time.
- Cashier.
- Product and phone details.
- IMEI where appropriate.
- Quantity.
- Unit price.
- Discount.
- Total.
- Payment method.
- Amount received.
- Change due.
- Outstanding balance.
- Warranty terms.
- Footer message.

Requirements:
- Burmese, Thai, and English output.
- Correct Unicode fonts.
- Configurable printer.
- Print preview.
- Reprint historical invoices.
- Respect original transaction values and currency.
- Never mark an invoice paid simply because it was printed.

Test actual printing where printer hardware is available. Otherwise document that physical printer validation remains outstanding.

==================================================
20. ABOUT PAGE
==================================================

Application:
Phone Second Shop POS

Developer:
Myominaung

Telegram:
@kominit

Telegram URL:
https://t.me/kominit

Display:
- Actual application version from package metadata.
- Platform information.
- Supported languages.
- Build information where available.
- Contact Developer button.
- Update information only if a genuine update provider is configured.

Do not display fabricated build, license, update, or verification status.

==================================================
21. SUPPORT DEVELOPER
==================================================

Support details:
- Payment method: KBZPay (KPay).
- Payment number: 09256060722.
- Telegram: @kominit.
- Telegram URL: https://t.me/kominit.

Implement:
- Support Developer page.
- Voluntary support message.
- Copy KPay Number button.
- Open Telegram button.
- Clear copy-success feedback.
- Localization in all supported languages.

Never claim that a donation has been received or verified without actual confirmation.

Do not expose private payment information beyond the supplied support details.

==================================================
22. BUG REPORT
==================================================

Create a functional Bug Report page.

Fields:
- Report category.
- Subject.
- Description.
- Reproduction steps.
- Expected behavior.
- Actual behavior.
- Optional screenshot.
- Optional diagnostic log.
- Application version.
- OS version.

Report categories:
- Bug / Error.
- UI Problem.
- Feature Request.
- Other.

Features:
- Validate required fields.
- Generate a readable report.
- Copy report to clipboard.
- Export report to a local text file.
- Provide a button to open Telegram @kominit.
- Allow the user to review diagnostic information before exporting.
- Redact sensitive information.

Privacy:
- Never include passwords, API keys, payment credentials, database contents, or customer personal information by default.
- Request permission before attaching screenshots or logs.
- Do not transmit reports automatically without an explicitly configured and authorized submission service.
- Do not claim that a report was submitted merely because Telegram opened.

==================================================
23. BACKUP AND RESTORE
==================================================

Implement:
- Manual database backup.
- Backup to a selected folder or external drive.
- Timestamped filenames.
- Backup validation.
- Restore preview where practical.
- Restore confirmation.
- Safety backup before restore.
- Database integrity checks.
- Document