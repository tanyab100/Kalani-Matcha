# Implementation Plan: Seasonal Menu Management

## Overview

Extends the existing Express/TypeScript backend and React frontend to give Store_Admin full CRUD control over menu items, customization groups, and options via a new `/admin/menu` interface. Changes are immediately reflected on the customer-facing menu.

## Tasks

- [x] 1. Database migration and pure service functions
  - [x] 1.1 Write migration 009_menu_admin.sql
    - Add `hidden BOOLEAN NOT NULL DEFAULT false` and `archived BOOLEAN NOT NULL DEFAULT false` to `menu_items`
    - Add partial index `menu_items_visible_idx` on `(hidden, archived)` where both are false
    - _Requirements: 5.2, 5.3, 6.2, 6.3, 11.1, 11.2_

  - [x] 1.2 Implement pure service functions for menu admin logic
    - Write `filterPublicItems(items)` — returns only items where `hidden = false` and `archived = false`
    - Write `sortAdminItems(items)` — sorts by category ASC then name ASC
    - Write `applyCreateDefaults(payload)` — merges `inStock: true, hidden: false, archived: false` onto a create payload
    - Write `toggleHidden(item, value)` and `toggleArchived(item, value)` helpers
    - Write `sortByOrder(items)` — sorts groups or options by `sortOrder` ASC
    - Place in `backend/src/services/menuAdminService.ts`
    - _Requirements: 1.4, 2.2, 5.2, 5.3, 6.2, 6.5, 8.1, 9.1, 11.1, 11.2_

  - [x]* 1.3 Write property tests for pure service functions
    - **Property 1: Public menu excludes hidden and archived items** — `filterPublicItems`
    - **Validates: Requirements 5.4, 6.3, 11.1, 11.2**
    - **Property 2: Public menu preserves inStock field** — `filterPublicItems`
    - **Validates: Requirements 4.5, 11.3**
    - **Property 3: Admin list includes all items regardless of flags** — `sortAdminItems` / list path
    - **Validates: Requirements 1.1, 1.4**
    - **Property 4: Admin list sort order** — `sortAdminItems`
    - **Validates: Requirements 1.4**
    - **Property 5: Created item has correct defaults** — `applyCreateDefaults`
    - **Validates: Requirements 2.2**
    - **Property 7: Hide/unhide round-trip** — `toggleHidden`
    - **Validates: Requirements 5.2, 5.3**
    - **Property 8: Archive/restore round-trip** — `toggleArchived`
    - **Validates: Requirements 6.2, 6.5**
    - **Property 9: Sort order for groups and options** — `sortByOrder`
    - **Validates: Requirements 8.1, 9.1**
    - Place in `backend/src/services/__tests__/menuAdmin.property.test.ts`

- [ ] 2. Backend TypeScript types and Zod validation
  - [x] 2.1 Extend `backend/src/types/menu.ts` with admin types
    - Add `AdminMenuItem`, `AdminCustomizationGroup`, `AdminCustomizationOption` interfaces
    - Add `CreateMenuItemBody`, `UpdateMenuItemBody`, `CreateGroupBody`, `CreateOptionBody` request body types
    - _Requirements: 2.1, 3.1, 8.2, 9.2_

  - [x] 2.2 Implement Zod validation schemas
    - Write `createMenuItemSchema`, `updateMenuItemSchema`, `createGroupSchema`, `createOptionSchema`
    - Place in `backend/src/routes/adminMenuValidation.ts`
    
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 3.4, 3.5, 8.8, 9.8, 9.9_

  - [ ]* 2.3 Write property test for validation rejection
    - **Property 6: Menu item validation rejects invalid inputs** — `validateMenuItemPayload`
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 3.4, 3.5**
    - **Property 10: Price delta validation rejects non-integers** — `validateOptionPayload`
    - **Validates: Requirements 9.9**
    - Place in `backend/src/services/__tests__/menuAdmin.property.test.ts`

- [ ] 3. Update public GET /menu route
  - [x] 3.1 Add hidden/archived filter to the existing public menu query
    - Add `WHERE mi.hidden = false AND mi.archived = false` to the `GET /menu` SQL query
    - Ensure `inStock` is included in the response shape
    - _Requirements: 4.5, 5.4, 6.3, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 3.2 Write unit tests for public menu filter
    - Test `GET /menu` excludes a hidden item after it is hidden
    - Test `GET /menu` excludes an archived item after it is archived
    - Test `GET /menu` includes `inStock` field on each item
    - _Requirements: 5.4, 6.3, 11.1, 11.2, 11.3_

- [ ] 4. Admin menu item routes
  - [x] 4.1 Implement `GET /admin/menu/items`
    - Return all items (including hidden and archived) ordered by category then name
    - Protect with `requireAdmin` middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 10.3_

  - [x] 4.2 Implement `POST /admin/menu/items`
    - Validate body with `createMenuItemSchema`
    - Insert row with `in_stock = true`, `hidden = false`, `archived = false` defaults
    - Return the created item
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 10.1, 10.2, 10.3_

  - [x] 4.3 Implement `PATCH /admin/menu/items/:id`
    - Validate body with `updateMenuItemSchema`
    - Return 404 if item does not exist
    - Return updated item
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.1, 10.2, 10.3_

  - [x] 4.4 Implement `PATCH /admin/menu/items/:id/in-stock`, `/hidden`, and `/archived`
    - Each accepts a single boolean field and updates the corresponding column
    - Return 404 if item does not exist
    - _Requirements: 4.2, 4.3, 4.4, 5.2, 5.3, 6.2, 6.5, 10.1, 10.2, 10.3_

  - [x] 4.5 Implement `DELETE /admin/menu/items/:id`
    - Return 404 if item does not exist
    - Rely on `ON DELETE CASCADE` for groups and options cleanup
    - _Requirements: 7.3, 7.5, 10.1, 10.2, 10.3_

  - [ ]* 4.6 Write unit tests for admin menu item routes
    - Test `GET /admin/menu/items` returns 401 without JWT, 403 with non-admin JWT
    - Test `POST /admin/menu/items` with valid payload creates item with correct defaults
    - Test `PATCH /admin/menu/items/:id` with non-existent ID returns 404
    - Test `DELETE /admin/menu/items/:id` with non-existent ID returns 404
    - _Requirements: 2.2, 3.6, 7.5, 10.1, 10.2, 10.3_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Admin customization group and option routes
  - [x] 6.1 Implement `GET /admin/menu/items/:id/groups`
    - Return groups ordered by `sort_order` ASC with nested options
    - _Requirements: 8.1, 9.1, 10.1_

  - [x] 6.2 Implement `POST /admin/menu/items/:id/groups`
    - Validate body with `createGroupSchema`
    - Insert group linked to the menu item
    - _Requirements: 8.2, 8.3, 8.8, 10.1, 10.2, 10.3_

  - [x] 6.3 Implement `PATCH /admin/menu/groups/:id` and `DELETE /admin/menu/groups/:id`
    - PATCH: validate with `createGroupSchema.partial()`, return 404 if not found
    - DELETE: cascade to options via `ON DELETE CASCADE`, return 404 if not found
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 10.1, 10.2, 10.3_

  - [x] 6.4 Implement `POST /admin/menu/groups/:id/options`, `PATCH /admin/menu/options/:id`, `DELETE /admin/menu/options/:id`
    - POST: validate with `createOptionSchema`
    - PATCH: validate with `createOptionSchema.partial()`
    - DELETE: remove single option
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3_

  - [ ]* 6.5 Write unit tests for customization routes
    - Test add group with missing label returns 400
    - Test add option with non-integer priceDelta returns 400
    - Test delete group cascades to its options
    - _Requirements: 8.8, 9.8, 9.9_

- [x] 7. Frontend types and API client
  - [x] 7.1 Mirror admin TypeScript interfaces in the frontend
    - Add `AdminMenuItem`, `AdminCustomizationGroup`, `AdminCustomizationOption` to `client/src/types/menu.ts` (or equivalent shared types file)
    - _Requirements: 1.2, 8.1, 9.1_

  - [x] 7.2 Implement `menuAdminApi.ts` API client module
    - Functions: `listAdminItems`, `createItem`, `updateItem`, `toggleInStock`, `toggleHidden`, `toggleArchived`, `deleteItem`
    - Functions: `listGroups`, `createGroup`, `updateGroup`, `deleteGroup`
    - Functions: `createOption`, `updateOption`, `deleteOption`
    - Place in `client/src/api/menuAdminApi.ts`
    - _Requirements: 1.4, 2.3, 3.3, 4.4, 5.5, 6.5, 7.4_

- [ ] 8. Frontend admin menu UI
  - [x] 8.1 Implement `DeleteConfirmDialog.tsx`
    - Reusable modal that shows a confirmation prompt before a destructive action
    - _Requirements: 7.2_

  - [x] 8.2 Implement `MenuItemForm.tsx`
    - Controlled form for create and edit with fields: name, description, basePrice (cents), category
    - Client-side validation: name required, category required and one of drinks/food/extras, basePrice non-negative integer
    - Display inline validation errors without submitting to the API
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 3.1, 3.4, 3.5_

  - [x] 8.3 Implement `MenuItemRow.tsx`
    - Display name, category, base price, in-stock toggle, hidden toggle, archive/restore button, edit button, delete button
    - Visually distinguish hidden items and archived items
    - Optimistic UI update on toggle — no full page reload
    - _Requirements: 1.2, 1.5, 1.6, 4.1, 4.4, 5.1, 5.5, 6.1, 6.4, 7.1, 7.4_

  - [x] 8.4 Implement `CustomizationGroupForm.tsx` and `CustomizationOptionForm.tsx`
    - Group form fields: label (required), required flag, sortOrder
    - Option form fields: label (required), priceDelta (integer cents), sortOrder
    - Client-side validation with inline errors
    - _Requirements: 8.2, 8.8, 9.2, 9.8, 9.9_

  - [x] 8.5 Implement `CustomizationGroupPanel.tsx`
    - Expandable panel per menu item showing groups ordered by sortOrder
    - Each group shows its options ordered by sortOrder
    - Add/edit/delete controls for groups and options with confirmation dialogs for deletes
    - _Requirements: 8.1, 8.2, 8.4, 8.6, 9.1, 9.2, 9.4, 9.6_

  - [x] 8.6 Implement `MenuAdminPage.tsx`
    - Route: `/admin/menu`
    - Load items via `listAdminItems` on mount; group by category
    - Render `MenuItemRow` per item and `CustomizationGroupPanel` for the selected item
    - Redirect unauthenticated users to login
    - _Requirements: 1.1, 1.3, 2.3, 3.3, 10.4_

  - [x] 8.7 Wire `/admin/menu` route into the app router
    - Add route entry in `App.tsx` (or router config) protected by admin auth guard
    - _Requirements: 10.4_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration and smoke tests
  - [ ]* 10.1 Write integration test for full item lifecycle
    - create → edit → hide → unhide → archive → restore → delete
    - Verify public `GET /menu` reflects each state change
    - _Requirements: 2.2, 3.2, 5.2, 5.3, 6.2, 6.5, 7.3, 11.4_

  - [ ]* 10.2 Write integration test for cascading delete
    - Create item with groups and options, delete item, verify groups and options are gone
    - _Requirements: 7.3_

  - [ ]* 10.3 Smoke test: migration 009 applies cleanly
    - Verify migration runs without error against the existing schema
    - Verify existing `GET /menu` consumers receive the same response shape after the filter addition
    - _Requirements: 11.1, 11.2, 11.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 5 and 9 ensure incremental validation
- Property tests use fast-check (minimum 100 runs each) and live in `backend/src/services/__tests__/menuAdmin.property.test.ts`
- Unit tests validate specific examples, auth enforcement, and error conditions
