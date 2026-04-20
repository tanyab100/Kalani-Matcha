# Requirements Document

## Introduction

This feature extends the existing matcha ordering app's admin section to give Store_Admin full control over the menu without requiring a code deploy or direct database access. Store_Admin can create, edit, hide, archive, and delete menu items, as well as manage the customization groups and options attached to each item. Changes take effect immediately for customers browsing the menu.

The existing app has a PostgreSQL database with `menu_items`, `customization_groups`, and `customization_options` tables, a JWT-authenticated Store_Admin role, a read-only `GET /menu` backend route, and an admin section at `/admin/slots`. This feature adds a full CRUD admin interface at `/admin/menu`.

## Glossary

- **Store_Admin**: The authenticated staff role that manages the menu; identified by a valid JWT with the `store_admin` role claim
- **Menu_Item**: A single orderable product with a name, description, base price, category, and in-stock status stored in the `menu_items` table
- **Category**: The classification of a Menu_Item; one of `drinks`, `food`, or `extras`
- **In_Stock_Status**: A boolean flag on a Menu_Item indicating whether customers can currently add it to their cart (`true` = available, `false` = unavailable)
- **Hidden_Status**: A boolean flag on a Menu_Item indicating whether the item is visible to customers on the public menu (`true` = hidden from customers, `false` = visible)
- **Archived_Status**: A soft-delete flag on a Menu_Item that removes it from all customer-facing views and prevents new orders; archived items are retained in the database for order history integrity
- **Customization_Group**: A named group of options attached to a Menu_Item (e.g., "Milk Type", "Sweetness Level"), stored in `customization_groups`
- **Customization_Option**: A single selectable choice within a Customization_Group (e.g., "Oat Milk", "50%"), stored in `customization_options`
- **Price_Delta**: An integer value in cents representing the price adjustment applied when a Customization_Option is selected; may be zero, positive, or negative
- **Sort_Order**: An integer that controls the display sequence of Customization_Groups and Customization_Options within their parent
- **Admin_Menu_Page**: The frontend page at `/admin/menu` where Store_Admin manages the menu
- **Menu_API**: The backend Express routes under `/admin/menu` that handle menu CRUD operations
- **Public_Menu_API**: The existing `GET /menu` route consumed by customers

---

## Requirements

### Requirement 1: Menu Item Listing

**User Story:** As a Store_Admin, I want to see all menu items in the admin panel, so that I can get a full picture of the current menu state including hidden and archived items.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL display all Menu_Items including items with Hidden_Status `true` and Archived_Status `true`
2. THE Admin_Menu_Page SHALL display each Menu_Item's name, category, base price, In_Stock_Status, Hidden_Status, and Archived_Status
3. THE Admin_Menu_Page SHALL group Menu_Items by Category
4. WHEN Store_Admin loads the Admin_Menu_Page, THE Menu_API SHALL return all Menu_Items ordered by category then by name ascending
5. THE Admin_Menu_Page SHALL visually distinguish hidden Menu_Items from visible ones
6. THE Admin_Menu_Page SHALL visually distinguish archived Menu_Items from active ones

---

### Requirement 2: Create Menu Item

**User Story:** As a Store_Admin, I want to add new menu items, so that I can introduce new drinks or food without a code deploy.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL provide a form for Store_Admin to create a new Menu_Item with name, description, base price, and category
2. WHEN Store_Admin submits a valid create form, THE Menu_API SHALL insert the Menu_Item into the `menu_items` table with `in_stock = true`, `hidden = false`, and `archived = false` as defaults
3. WHEN Store_Admin submits a valid create form, THE Admin_Menu_Page SHALL display the new Menu_Item in the list without a full page reload
4. IF Store_Admin submits a create form with a missing name, THEN THE Admin_Menu_Page SHALL display a validation error identifying the missing field and SHALL NOT submit the request to the Menu_API
5. IF Store_Admin submits a create form with a missing category, THEN THE Admin_Menu_Page SHALL display a validation error identifying the missing field and SHALL NOT submit the request to the Menu_API
6. IF Store_Admin submits a create form with a base price that is not a non-negative integer number of cents, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API
7. IF Store_Admin submits a create form with a category value outside of `drinks`, `food`, or `extras`, THEN THE Menu_API SHALL reject the request with a 400 status and a descriptive error message

---

### Requirement 3: Edit Menu Item

**User Story:** As a Store_Admin, I want to edit existing menu items, so that I can update names, descriptions, prices, and categories as the menu evolves.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL provide an edit form pre-populated with the existing values for each Menu_Item
2. WHEN Store_Admin submits a valid edit form, THE Menu_API SHALL update the corresponding row in `menu_items` and return the updated Menu_Item
3. WHEN Store_Admin submits a valid edit form, THE Admin_Menu_Page SHALL reflect the updated values without a full page reload
4. IF Store_Admin submits an edit form with a missing name, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API
5. IF Store_Admin submits an edit form with a base price that is not a non-negative integer number of cents, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API
6. IF Store_Admin attempts to edit a Menu_Item that does not exist, THEN THE Menu_API SHALL return a 404 status with a descriptive error message

---

### Requirement 4: Toggle In-Stock Status

**User Story:** As a Store_Admin, I want to toggle a menu item's in-stock status, so that I can quickly mark items as unavailable when they run out without removing them from the menu.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL display an in-stock toggle control for each Menu_Item
2. WHEN Store_Admin toggles In_Stock_Status to `false`, THE Menu_API SHALL update `in_stock` to `false` for that Menu_Item
3. WHEN Store_Admin toggles In_Stock_Status to `true`, THE Menu_API SHALL update `in_stock` to `true` for that Menu_Item
4. WHEN In_Stock_Status is updated, THE Admin_Menu_Page SHALL reflect the new status without a full page reload
5. WHILE a Menu_Item has In_Stock_Status `false`, THE Public_Menu_API SHALL return the item with `inStock: false` so that the customer-facing menu displays it as unavailable

---

### Requirement 5: Hide and Unhide Menu Items

**User Story:** As a Store_Admin, I want to hide menu items from customers without deleting them, so that I can manage seasonal availability without losing item configuration.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL provide a hide/unhide control for each non-archived Menu_Item
2. WHEN Store_Admin hides a Menu_Item, THE Menu_API SHALL set `hidden = true` on that Menu_Item
3. WHEN Store_Admin unhides a Menu_Item, THE Menu_API SHALL set `hidden = false` on that Menu_Item
4. WHILE a Menu_Item has Hidden_Status `true`, THE Public_Menu_API SHALL exclude that Menu_Item from the customer-facing menu response
5. WHEN Hidden_Status is updated, THE Admin_Menu_Page SHALL reflect the new status without a full page reload

---

### Requirement 6: Archive and Restore Menu Items

**User Story:** As a Store_Admin, I want to archive menu items that are permanently discontinued, so that they disappear from the menu but their data is preserved for past order history.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL provide an archive control for each non-archived Menu_Item
2. WHEN Store_Admin archives a Menu_Item, THE Menu_API SHALL set `archived = true` on that Menu_Item
3. WHILE a Menu_Item has Archived_Status `true`, THE Public_Menu_API SHALL exclude that Menu_Item from the customer-facing menu response
4. THE Admin_Menu_Page SHALL provide a restore control for each archived Menu_Item
5. WHEN Store_Admin restores an archived Menu_Item, THE Menu_API SHALL set `archived = false` on that Menu_Item
6. THE Menu_API SHALL NOT permanently delete a Menu_Item that is referenced by any existing order snapshot

---

### Requirement 7: Delete Menu Item

**User Story:** As a Store_Admin, I want to permanently delete menu items that were created by mistake, so that the admin list stays clean.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL provide a delete control for each Menu_Item
2. WHEN Store_Admin initiates a delete, THE Admin_Menu_Page SHALL display a confirmation prompt before submitting the request
3. WHEN Store_Admin confirms deletion, THE Menu_API SHALL permanently delete the Menu_Item and its associated Customization_Groups and Customization_Options via cascading delete
4. WHEN a Menu_Item is deleted, THE Admin_Menu_Page SHALL remove it from the list without a full page reload
5. IF Store_Admin attempts to delete a Menu_Item that does not exist, THEN THE Menu_API SHALL return a 404 status with a descriptive error message

---

### Requirement 8: Manage Customization Groups

**User Story:** As a Store_Admin, I want to add, edit, reorder, and remove customization groups on a menu item, so that I can control what choices customers see for each drink.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL display all Customization_Groups for a selected Menu_Item, ordered by Sort_Order ascending
2. THE Admin_Menu_Page SHALL provide a form to add a new Customization_Group with a label, required flag, and Sort_Order
3. WHEN Store_Admin submits a valid add-group form, THE Menu_API SHALL insert the Customization_Group into `customization_groups` linked to the correct Menu_Item
4. THE Admin_Menu_Page SHALL provide an edit form for each Customization_Group to update its label, required flag, and Sort_Order
5. WHEN Store_Admin submits a valid edit-group form, THE Menu_API SHALL update the corresponding row in `customization_groups`
6. THE Admin_Menu_Page SHALL provide a delete control for each Customization_Group
7. WHEN Store_Admin confirms deletion of a Customization_Group, THE Menu_API SHALL permanently delete the Customization_Group and all of its Customization_Options via cascading delete
8. IF Store_Admin submits an add or edit group form with a missing label, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API

---

### Requirement 9: Manage Customization Options

**User Story:** As a Store_Admin, I want to add, edit, reorder, and remove customization options within a group, so that I can control the exact choices available to customers.

#### Acceptance Criteria

1. THE Admin_Menu_Page SHALL display all Customization_Options within each Customization_Group, ordered by Sort_Order ascending
2. THE Admin_Menu_Page SHALL provide a form to add a new Customization_Option with a label, Price_Delta, and Sort_Order
3. WHEN Store_Admin submits a valid add-option form, THE Menu_API SHALL insert the Customization_Option into `customization_options` linked to the correct Customization_Group
4. THE Admin_Menu_Page SHALL provide an edit form for each Customization_Option to update its label, Price_Delta, and Sort_Order
5. WHEN Store_Admin submits a valid edit-option form, THE Menu_API SHALL update the corresponding row in `customization_options`
6. THE Admin_Menu_Page SHALL provide a delete control for each Customization_Option
7. WHEN Store_Admin confirms deletion of a Customization_Option, THE Menu_API SHALL permanently delete that Customization_Option
8. IF Store_Admin submits an add or edit option form with a missing label, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API
9. IF Store_Admin submits an add or edit option form with a Price_Delta that is not an integer number of cents, THEN THE Admin_Menu_Page SHALL display a validation error and SHALL NOT submit the request to the Menu_API

---

### Requirement 10: Access Control

**User Story:** As a Store_Admin, I want all menu management endpoints to be protected, so that customers cannot modify the menu.

#### Acceptance Criteria

1. THE Menu_API SHALL require a valid Store_Admin JWT on all write endpoints (`POST`, `PATCH`, `DELETE`)
2. IF a request to a Menu_API write endpoint is made without a valid Store_Admin JWT, THEN THE Menu_API SHALL return a 401 status
3. IF a request to a Menu_API write endpoint is made with a JWT that does not carry the `store_admin` role claim, THEN THE Menu_API SHALL return a 403 status
4. THE Admin_Menu_Page SHALL redirect unauthenticated users to the login page

---

### Requirement 11: Public Menu Consistency

**User Story:** As a customer, I want the menu I see to always reflect the current published state, so that I never see items that are unavailable or hidden.

#### Acceptance Criteria

1. THE Public_Menu_API SHALL exclude all Menu_Items where `hidden = true` from the response
2. THE Public_Menu_API SHALL exclude all Menu_Items where `archived = true` from the response
3. THE Public_Menu_API SHALL include `inStock` in the response for each Menu_Item so the customer-facing UI can display out-of-stock state
4. WHEN a Store_Admin change is saved, THE Public_Menu_API SHALL reflect the updated state on the next customer request without requiring a server restart
