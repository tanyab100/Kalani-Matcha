# Requirements Document

## Introduction

A TypeScript-based mobile-first web app for a matcha business serving local pickup customers. Customers can browse the menu, customize drinks, place pickup orders, track order status, and quickly reorder past favorites. The app includes a simple checkout flow with secure payment processing.

## Glossary

- **App**: The matcha ordering web application
- **Customer**: A user placing a pickup order
- **Menu**: The list of available matcha drinks and food items
- **Order**: A collection of one or more items selected by a Customer for pickup
- **Cart**: The temporary collection of items a Customer is building before checkout
- **Checkout**: The process of reviewing the Cart, entering payment, and confirming an Order
- **Payment_Processor**: The external service handling payment transactions
- **Order_History**: The record of a Customer's past completed Orders
- **Reorder**: The action of adding all items from a past Order back into the Cart
- **Item**: A single menu product (drink or food) with optional customizations
- **Customization**: A modifier applied to an Item (e.g., sweetness level, milk type, temperature)
- **Pickup_Time**: The scheduled time a Customer will collect their Order in-store
- **Store_Admin**: Staff or system responsible for updating order statuses and managing pickup slot capacity
- **Capacity_Unit**: The unit of slot usage, equal to 1 per item quantity. Each slot has a default capacity of 5 Capacity_Units.
- **Venmo_Link**: A deep-link URL to the store's Venmo profile with the order total pre-filled, used for manual payment

---

## Requirements

### Requirement 1: Authentication

**User Story:** As a Customer, I want to choose whether to sign in or check out as a guest, so that I can place orders with or without an account.

#### Acceptance Criteria

1. THE App SHALL allow Customers to place an Order without creating an account via guest checkout
2. THE App SHALL allow Customers to sign in to an existing account before or during Checkout
3. THE App SHALL restrict access to Order_History to signed-in Customers only
4. IF a guest Customer attempts to access Order_History, THEN THE App SHALL prompt the Customer to sign in

---

### Requirement 2: Menu Browsing

**User Story:** As a Customer, I want to browse the matcha menu, so that I can discover available drinks and food items.

#### Acceptance Criteria

1. THE App SHALL display all available menu Items grouped by category (e.g., drinks, food, extras)
2. WHEN a Customer selects an Item, THE App SHALL display the Item's name, description, price, and available Customizations
3. WHILE an Item is out of stock, THE App SHALL display the Item as unavailable and prevent the Customer from adding it to the Cart
4. WHEN a Customer applies a category filter, THE App SHALL display only Items belonging to the selected category

---

### Requirement 3: Item Customization

**User Story:** As a Customer, I want to customize my matcha drink, so that I can get it exactly how I like it.

#### Acceptance Criteria

1. WHEN a Customer selects an Item, THE App SHALL present all available Customization options for that Item
2. WHEN a Customer selects a Customization that affects price, THE App SHALL update the displayed Item price in real time
3. THE App SHALL require the Customer to select a value for each mandatory Customization before adding the Item to the Cart
4. IF a Customer attempts to add an Item with an incomplete mandatory Customization, THEN THE App SHALL display a validation message identifying the missing Customization

---

### Requirement 4: Cart Management

**User Story:** As a Customer, I want to manage my cart, so that I can review and adjust my order before paying.

#### Acceptance Criteria

1. WHEN a Customer adds an Item to the Cart, THE App SHALL display the updated Cart item count
2. THE App SHALL display the Cart with each Item's name, selected Customizations, quantity, and line-item price
3. WHEN a Customer updates an Item quantity in the Cart, THE App SHALL recalculate and display the updated Cart total
4. WHEN a Customer removes an Item from the Cart, THE App SHALL remove the Item and recalculate the Cart total
5. THE App SHALL display the Cart subtotal, applicable taxes, and order total at all times while the Cart is non-empty
6. THE App SHALL preserve Cart contents across page refreshes for the active session
7. IF a Customer returns to the App within the session, THEN THE App SHALL restore the existing Cart contents

---

### Requirement 5: Checkout

**User Story:** As a Customer, I want a simple checkout experience, so that I can place my order quickly and confidently.

#### Acceptance Criteria

1. WHEN a Customer initiates Checkout, THE App SHALL display an order summary including all Cart Items, subtotal, taxes, and total
2. WHEN a Customer initiates Checkout, THE App SHALL prompt the Customer to select a Pickup_Time from available time slots
3. THE App SHALL display only Pickup_Time slots within store operating hours
4. THE App SHALL exclude unavailable or fully booked Pickup_Time slots
5. THE App SHALL enforce a minimum preparation time of 10 minutes before the earliest available Pickup_Time slot
6. IF a selected Pickup_Time becomes unavailable before Order confirmation, THEN THE App SHALL prompt the Customer to select a new Pickup_Time
7. THE App SHALL calculate taxes according to configured store tax rules
8. THE App SHALL collect payment information via the Payment_Processor before confirming the Order
9. WHEN the Payment_Processor confirms a successful transaction, THE App SHALL create the Order and display an order confirmation with an order number and selected Pickup_Time
10. IF the Payment_Processor returns a payment failure, THEN THE App SHALL display a descriptive error message and allow the Customer to retry or use a different payment method
11. IF the Customer's Cart is empty, THEN THE App SHALL prevent the Customer from proceeding to Checkout and display a prompt to add Items

---

### Requirement 6: Payment Processing

**User Story:** As a Customer, I want my payment to be handled securely, so that I can trust my financial information is protected.

#### Acceptance Criteria

1. THE App SHALL transmit payment data exclusively through the Payment_Processor's secure API and SHALL NOT store raw card details
2. WHEN a payment transaction is initiated, THE App SHALL display a loading indicator until the Payment_Processor returns a response
3. IF the Payment_Processor returns a network timeout, THEN THE App SHALL display an error message and preserve the Customer's Cart contents
4. THE App SHALL support at least one card-based payment method via the Payment_Processor
5. THE App SHALL prevent duplicate Order creation if a payment request is retried or refreshed
6. THE App SHALL NOT create an Order unless payment is successfully confirmed by the Payment_Processor
7. THE App SHALL offer Venmo as an alternative payment method at Checkout
8. WHEN a Customer selects Venmo, THE App SHALL display a "Pay via Venmo" button that opens the store's Venmo profile with the order total pre-filled
9. WHEN a Customer selects Venmo, THE App SHALL create the Order with a `pending_payment` status and display instructions to complete payment in the Venmo app
10. THE App SHALL require Store_Admin to manually confirm Venmo payment receipt before the Order status advances to `received`

---

### Requirement 7: Order Confirmation and Status

**User Story:** As a Customer, I want to see my order status after placing it, so that I know when to pick it up.

#### Acceptance Criteria

1. WHEN an Order is confirmed, THE App SHALL display the order number, itemized order summary, and Pickup_Time
2. WHEN an Order status changes, THE App SHALL update the displayed order status for the Customer
3. THE App SHALL display order statuses: Pending Payment (Venmo only), Received, Preparing, Ready for Pickup

---

### Requirement 8: Order History and Fast Reorder

**User Story:** As a Customer, I want to view my past orders and reorder quickly, so that I can get my usual without rebuilding it from scratch.

#### Acceptance Criteria

1. THE App SHALL display the Customer's Order_History as a list of past Orders sorted by date descending
2. WHEN a Customer views a past Order, THE App SHALL display the Order's Items, Customizations, total, and date
3. WHEN a Customer triggers a Reorder, THE App SHALL add all Items from the selected past Order into the Cart with their original Customizations
4. IF any Item from a past Order is no longer available, THEN THE App SHALL notify the Customer and add only the available Items to the Cart
5. IF an Item price has changed since the original Order, THEN THE App SHALL use the current Menu price
6. IF a past Customization is no longer available, THEN THE App SHALL notify the Customer and require an updated selection before checkout
7. WHEN a Customer triggers a Reorder, THE App SHALL navigate the Customer to the Cart

---

### Requirement 10: Tipping

**User Story:** As a Customer, I want to add a tip during checkout, so that I can show appreciation for the staff.

#### Acceptance Criteria

1. THE App SHALL allow the Customer to select a tip amount during Checkout
2. THE App SHALL display preset tip options (e.g., 10%, 15%, 20%) and a custom amount option
3. WHEN a Customer selects a tip, THE App SHALL update the order total in real time
4. THE App SHALL include the tip amount in the final payment request to the Payment Processor
5. IF no tip is selected, THEN THE App SHALL default the tip amount to 0
6. THE App SHALL display the tip amount separately from subtotal, tax, and total

---

### Requirement 11: Slot Capacity Management

**User Story:** As a Store_Admin, I want to set and update the maximum preparation capacity for each pickup time slot, with a default of 5 total items per slot, so that the kitchen is never overloaded.

#### Acceptance Criteria

1. THE App SHALL enforce a default maximum of 5 total items (sum of all item quantities) per Pickup_Time slot
2. THE App SHALL reject new Orders that would cause the total slot usage to exceed the configured slot capacity
3. THE App SHALL allow Store_Admin to update slot capacity for future Pickup_Time slots only
4. THE App SHALL calculate slot usage as the sum of item quantities across all confirmed Orders in a slot

---

### Requirement 9: Mobile-First UI

**User Story:** As a Customer using a mobile device, I want a clean and responsive interface, so that I can place orders comfortably from my phone.

#### Acceptance Criteria

1. THE App SHALL render all views in a single-column layout on screens with a width of 390px or less
2. THE App SHALL meet a Lighthouse mobile performance score of 80 or above on the order and checkout pages
3. THE App SHALL display touch targets with a minimum size of 44x44 CSS pixels for all interactive elements
4. THE App SHALL keep key order flows performant on mid-range mobile devices under normal network conditions
