# Bug Test Scenario: Food Category Price Display Fix

## Bug Summary
**Issue**: `Cannot read properties of undefined (reading 'toFixed')` error when viewing food categories
**Location**: `ItemSequenceDialog.tsx` line 465
**Root Cause**: Missing validation for NaN/Infinity values before calling `.toFixed()` on item prices
**Affected Features**: Day-wise category item sequencing, flat category item display

---

## Test Scenario Setup

### Prerequisites
1. Admin user account with access to food category management
2. Existing food items with various item types (simple, portions, combo)
3. Test items with edge case pricing (see Edge Cases section)
4. At least one flat category and one day-wise category created

### Test Data Required

#### Simple Items
- Item with valid price: `$10.99`
- Item with no price set (undefined/null)
- Item with price: `$0.00`
- Item with invalid price data (NaN) - **must create via API/script**

#### Portioned Items
- Item with 2 portions: `$8.99 - $12.99`
- Item with 3+ portions: `$5.99 - $15.99`
- Item with single portion: `$9.99`
- Item with empty portionPrices array: `[]`
- Item with null/undefined portionPrices

#### Combo Items
- Item with base price: `$25.99`
- Item with no base price set
- Combo with multiple sections

---

## TEST SCENARIO: Flat Categories

### Test Case 1: Navigate to Food Categories Page
**Steps**:
1. Login as admin
2. Navigate to `/admin/food-category`
3. Verify page loads without errors
4. Check browser console for any errors

**Expected Results**:
- Page loads successfully
- No console errors
- All categories displayed
- Category cards show correct item counts (not just "N items")

**Pass Criteria**: ✅ Page loads, categories visible, no console errors

---

### Test Case 2: Open Flat Category (Not Day-Wise)
**Steps**:
1. Identify a flat category from the category list
2. Click on the category to open it
3. Verify category details page loads
4. Check that listing type shows "Flat Category"

**Expected Results**:
- Category details page loads
- Listing type chip shows "Flat Category" in green
- Items section visible with "Add Item" button
- No console errors on load

**Pass Criteria**: ✅ Flat category opens successfully, correct type displayed

---

### Test Case 3: Click 'Add Item' Button
**Steps**:
1. On the flat category items page
2. Click "Add Item" button
3. Wait for AddItemDialog to open
4. Verify dialog displays properly

**Expected Results**:
- AddItemDialog opens in modal
- Dialog shows "Add Items to Category" title
- Search field visible and functional
- No toFixed errors in console
- Items start loading

**Pass Criteria**: ✅ Dialog opens without errors, loading state shows

---

### Test Case 4: Search for Items in AddItemDialog
**Steps**:
1. In the AddItemDialog search field
2. Type search query (e.g., "chicken")
3. Verify items filter correctly
4. Clear search
5. Verify all items return

**Expected Results**:
- Items filter based on search query
- Search matches item name and description
- Clear button appears when typing
- No errors during search/filter

**Pass Criteria**: ✅ Search works, no errors during filtering

---

### Test Case 5: Verify Portioned Items Show Price Range
**Steps**:
1. In the AddItemDialog items list
2. Locate a portioned item (has multiple portion prices)
3. Check the price display
4. Verify format shows range: "$8.99 - $12.99"

**Expected Results**:
- Portioned items display price range
- Format: `${minPrice} - ${maxPrice}`
- Both prices formatted with 2 decimals
- No toFixed errors
- Prices calculated correctly from portionPrices array

**Example**:
```
Pasta Primavera
$8.99 - $13.99
```

**Pass Criteria**: ✅ Price range displayed correctly, no errors

---

### Test Case 6: Verify Simple Items Show Single Price
**Steps**:
1. In the AddItemDialog items list
2. Locate a simple item (itemType: 'simple')
3. Check the price display
4. Verify format shows single price: "$10.99"

**Expected Results**:
- Simple items display single price
- Format: `${price}`
- Price formatted with 2 decimals
- No toFixed errors
- Uses safeFormatCurrency utility

**Example**:
```
Grilled Chicken Sandwich
$12.99
```

**Pass Criteria**: ✅ Single price displayed correctly, no errors

---

### Test Case 7: Verify Combo Items Show Base Price
**Steps**:
1. In the AddItemDialog items list
2. Locate a combo item (itemType: 'combo')
3. Check the price display
4. Verify base price is shown

**Expected Results**:
- Combo items display base price
- Uses item.price field
- Price formatted with 2 decimals
- No toFixed errors
- Shows "N/A" if no base price

**Pass Criteria**: ✅ Combo price displayed correctly or "N/A"

---

### Test Case 8: Select Mixed Item Types
**Steps**:
1. Select a simple item checkbox
2. Select a portioned item checkbox
3. Select a combo item checkbox
4. Verify selection counter updates
5. Check all selected items have correct price displays

**Expected Results**:
- Multiple items can be selected
- Selection counter shows correct count (e.g., "3 selected")
- All selected items maintain correct price display
- No errors when selecting different item types
- Visual feedback shows selected state

**Pass Criteria**: ✅ Mixed selection works, prices display correctly

---

### Test Case 9: Add Items to Category
**Steps**:
1. With items selected (simple, portions, combo)
2. Click "Add X Items" button
3. Wait for save operation
4. Monitor browser console
5. Verify success message appears
6. Dialog closes

**Expected Results**:
- Save operation completes without errors
- No "Cannot read properties of undefined (reading 'toFixed')" error
- Success snackbar/notification appears
- Dialog closes after successful save
- Items are added to category

**Pass Criteria**: ✅ Items added successfully, no toFixed errors

---

### Test Case 10: Verify All Items Listed (Not Just Count)
**Steps**:
1. After adding items, return to category items page
2. Scroll through items list
3. Verify each item is displayed individually
4. Check that items show details, not just a count

**Expected Results**:
- Each item displayed as a separate row/card
- Items show: name, description, veg/non-veg indicator, price
- No items hidden behind "N items" display
- All added items visible in list

**Example Display**:
```
✓ Grilled Chicken Sandwich   $12.99  [Remove]
✓ Pasta Primavera            $8.99 - $13.99  [Remove]
✓ Family Feast Combo         $25.99  [Remove]
```

**Pass Criteria**: ✅ All items listed individually with details

---

### Test Case 11: Verify Portioned Items Show Price Range on Category Page
**Steps**:
1. On the category items page
2. Locate a portioned item in the list
3. Check the price display format
4. Verify range is shown correctly

**Expected Results**:
- Portioned items display min-max price range
- Format: `$8.99 - $13.99`
- Uses Math.min and Math.max on portionPrices
- Safe formatting prevents toFixed errors
- Consistent with AddItemDialog display

**Pass Criteria**: ✅ Price range displayed correctly on category page

---

### Test Case 12: Verify Simple Items Show Single Price on Category Page
**Steps**:
1. On the category items page
2. Locate simple items
3. Check price display
4. Verify single price format

**Expected Results**:
- Simple items show single price
- Format: `$12.99`
- 2 decimal places
- No errors when rendering
- Uses safeFormatCurrency

**Pass Criteria**: ✅ Single prices displayed correctly

---

### Test Case 13: Test Removing Items from Category
**Steps**:
1. On the category items page
2. Click remove button (trash icon) on an item
3. Wait for removal operation
4. Verify item is removed from list
5. Check for console errors

**Expected Results**:
- Remove button works for all item types
- Confirmation may be required (if implemented)
- Item removed from display after operation
- No toFixed errors during removal
- List updates correctly

**Pass Criteria**: ✅ Items can be removed without errors

---

### Test Case 14: Verify All Operations Work Without Console Errors
**Steps**:
1. Open browser DevTools Console
2. Navigate through entire flow:
   - Category list → Flat category → Add items → View items → Remove items
3. Perform all operations: search, select, add, remove
4. Monitor console for ANY errors

**Expected Results**:
- NO "Cannot read properties of undefined" errors
- NO "toFixed" related errors
- NO TypeError or ReferenceError
- Only expected logs/info messages
- All operations complete successfully

**Pass Criteria**: ✅ Zero console errors throughout entire flow

---

## EDGE CASES TO TEST

### Edge Case 1: Item with No Price (undefined/null)
**Steps**:
1. Create/find item with price: undefined or null
2. Add to category
3. View in category items list
4. Check price display

**Expected Results**:
- Price shows "N/A" or "$0.00"
- No toFixed error
- Item can be added/removed successfully
- No crashes or errors

**Pass Criteria**: ✅ Handles missing price gracefully

---

### Edge Case 2: Portioned Item with Empty portionPrices Array
**Steps**:
1. Create item with itemType: 'portions'
2. Set portionPrices: []
3. Add to category
4. View in items list

**Expected Results**:
- Price shows "N/A" or fallback
- No error when calling Math.min/max on empty array
- Array length check prevents Math.min/max error
- Safe display without crashes

**Pass Criteria**: ✅ Handles empty portionPrices gracefully

---

### Edge Case 3: Portioned Item with Single Portion
**Steps**:
1. Create portioned item with one price: [9.99]
2. Add to category
3. Check price display

**Expected Results**:
- Price shows range: "$9.99 - $9.99"
- Or shows single price: "$9.99"
- Math.min and Math.max both return 9.99
- No errors

**Pass Criteria**: ✅ Single portion handled correctly

---

### Edge Case 4: Combo Item with No Base Price
**Steps**:
1. Create combo item without price field
2. Add to category
3. View in items list

**Expected Results**:
- Price shows "N/A" or "$0.00"
- No toFixed error
- Combo displays correctly despite missing price
- Sections still visible

**Pass Criteria**: ✅ Missing combo price handled gracefully

---

### Edge Case 5: Price with NaN Value (Corrupted Data)
**Steps**:
1. Create item via API with price: NaN
2. Add to category
3. View in items list
4. Check price display

**Expected Results**:
- Price shows fallback: "$0.00"
- NO toFixed error (this is the critical fix!)
- safeFormatCurrency handles NaN internally
- No crash or console error

**Pass Criteria**: ✅ NaN price handled without error (CRITICAL)

---

### Edge Case 6: Price with Infinity Value
**Steps**:
1. Create item with price: Infinity
2. Add to category
3. View display

**Expected Results**:
- Price shows fallback: "$0.00"
- No toFixed error
- safeFormatCurrency validates isFinite()
- System handles gracefully

**Pass Criteria**: ✅ Infinity handled without error

---

### Edge Case 7: Negative Price (Invalid Business Logic)
**Steps**:
1. Create item with price: -10.99
2. Add to category
3. View display

**Expected Results**:
- Price shows "$0.00" (fallback) or "$-10.99" (if allowed)
- No toFixed error
- Handled by safeFormatCurrency validation

**Pass Criteria**: ✅ Negative price handled gracefully

---

### Edge Case 8: Price as String (Type Mismatch)
**Steps**:
1. Create item with price: "12.99" (string)
2. Add to category
3. View display

**Expected Results**:
- Price displayed correctly: "$12.99"
- safeFormatCurrency converts string to number
- parseFloat handles conversion
- No toFixed error

**Pass Criteria**: ✅ String price converted and displayed

---

### Edge Case 9: Large Price Values
**Steps**:
1. Create item with price: 999999.99
2. Add to category
3. View display

**Expected Results**:
- Price displayed: "$999999.99"
- No formatting issues
- No toFixed error
- Handles large numbers

**Pass Criteria**: ✅ Large prices formatted correctly

---

### Edge Case 10: Very Small Decimal Prices
**Steps**:
1. Create item with price: 0.01
2. Add to category
3. View display

**Expected Results**:
- Price displayed: "$0.01"
- No rounding issues
- Correct decimal display
- No toFixed error

**Pass Criteria**: ✅ Small decimals handled correctly

---

## TEST SCENARIO: Day-Wise Categories

### Test Case 15: Open Day-Wise Category
**Steps**:
1. Navigate to food categories page
2. Identify a day-wise category
3. Click to open category
4. Verify day-wise interface loads

**Expected Results**:
- Category opens successfully
- Listing type shows "Day-wise Category" in purple
- Day-wise item selector visible
- No toFixed errors on load
- THIS IS THE CRITICAL PATH FOR ItemSequenceDialog BUG

**Pass Criteria**: ✅ Day-wise category opens, no errors

---

### Test Case 16: Open Item Sequence Dialog
**Steps**:
1. On day-wise category page
2. Click "Arrange Items" or sequence button
3. Wait for ItemSequenceDialog to open
4. **CRITICAL: Check for toFixed error**

**Expected Results**:
- ItemSequenceDialog opens
- Items load for selected day
- **NO "Cannot read properties of undefined (reading 'toFixed')" error**
- Items display with prices correctly
- Drag-and-drop available for reordering

**CRITICAL PASS Criteria**: ✅ Dialog opens WITHOUT toFixed error (BUG FIX VERIFICATION)

---

### Test Case 17: Verify Prices in ItemSequenceDialog
**Steps**:
1. In ItemSequenceDialog with items loaded
2. Check each item's price display
3. Look for items with potentially invalid prices
4. Verify all prices show correctly

**Expected Results**:
- All items show prices correctly
- Simple items: "$12.99"
- Portioned items: "$8.99 - $13.99"
- Combo items: Base price or "N/A"
- **NO toFixed errors for ANY item type**
- Invalid prices show "$0.00" or "N/A"

**CRITICAL PASS Criteria**: ✅ All prices display without toFixed errors

---

### Test Case 18: Test Item Reordering
**Steps**:
1. In ItemSequenceDialog
2. Drag items to reorder
3. Drop items in new position
4. Verify order updates
5. Check for errors during drag-drop

**Expected Results**:
- Drag-drop works smoothly
- No toFixed errors during reordering
- Prices remain visible and correct
- Order saves successfully
- No console errors

**Pass Criteria**: ✅ Reordering works without price display errors

---

### Test Case 19: Switch Between Days
**Steps**:
1. In day-wise category
2. Select different day from dropdown
3. Wait for items to load
4. Verify prices display correctly
5. Check for errors when switching days

**Expected Results**:
- Items load for each day
- Prices display correctly for all days
- No toFixed errors when switching
- Smooth transitions between days
- Each day's items show correct prices

**Pass Criteria**: ✅ Day switching works without errors

---

## Regression Tests

### Regression Test 1: Verify Existing Categories Still Work
**Steps**:
1. Navigate to existing categories
2. Open various categories (flat and day-wise)
3. View items in each
4. Verify all functionality works

**Expected Results**:
- All existing categories function correctly
- No new errors introduced
- Prices display correctly
- Add/remove operations work

**Pass Criteria**: ✅ No regressions in existing functionality

---

### Regression Test 2: Verify Food Items Page Still Works
**Steps**:
1. Navigate to `/admin/food-items`
2. Browse items list
3. Check price displays in table
4. Perform item searches

**Expected Results**:
- Food items page loads
- Prices display correctly in table
- Portioned items show ranges
- No toFixed errors
- All filters work

**Pass Criteria**: ✅ Food items page unaffected by fix

---

### Regression Test 3: Verify Other Price Displays
**Steps**:
1. Check Dashboard statistics
2. View Orders page with order totals
3. Check any other pages with price displays
4. Verify all price formatting works

**Expected Results**:
- All price displays work correctly
- No toFixed errors anywhere
- Consistent formatting across all pages
- safeFormatCurrency used throughout

**Pass Criteria**: ✅ All price displays functional

---

## Performance Tests

### Performance Test 1: Large Category
**Steps**:
1. Create category with 100+ items
2. Open category
3. Measure load time
4. Check for errors during load

**Expected Results**:
- Category loads in reasonable time (< 3 seconds)
- No toFixed errors during bulk rendering
- All prices display correctly
- No performance degradation

**Pass Criteria**: ✅ Large categories load without errors

---

### Performance Test 2: Rapid Add/Remove Operations
**Steps**:
1. Open category items page
2. Rapidly add and remove items
3. Perform 10+ operations quickly
4. Monitor for errors

**Expected Results**:
- All operations complete successfully
- No toFixed errors during rapid operations
- UI remains responsive
- No memory leaks

**Pass Criteria**: ✅ Rapid operations handled gracefully

---

## Browser Compatibility Tests

### Browser Test: Chrome
**Steps**:
1. Open in latest Chrome
2. Run through all test scenarios
3. Verify functionality

**Expected Results**: All tests pass in Chrome

---

### Browser Test: Firefox
**Steps**:
1. Open in latest Firefox
2. Run through all test scenarios
3. Verify functionality

**Expected Results**: All tests pass in Firefox

---

### Browser Test: Safari
**Steps**:
1. Open in latest Safari
2. Run through all test scenarios
3. Verify functionality

**Expected Results**: All tests pass in Safari

---

### Browser Test: Edge
**Steps**:
1. Open in latest Edge
2. Run through all test scenarios
3. Verify functionality

**Expected Results**: All tests pass in Edge

---

## Console Error Checks

### Critical Console Errors to Watch For

1. ❌ `Cannot read properties of undefined (reading 'toFixed')`
   - **This is the main bug we're fixing**
   - Should NEVER appear after fix

2. ❌ `TypeError: undefined.toFixed`
   - Variant of above error
   - Should NOT appear

3. ❌ `TypeError: NaN.toFixed`
   - Occurs if NaN values not validated
   - Should NOT appear

4. ❌ `TypeError: Infinity.toFixed`
   - Occurs if Infinity values not validated
   - Should NOT appear

5. ✅ Acceptable console output:
   - Info logs
   - Network requests
   - Warning (if any)
   - NO TypeError or ReferenceError

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backup current database/state
- [ ] Create test items (all types)
- [ ] Create test categories (flat and day-wise)
- [ ] Prepare edge case data
- [ ] Open browser DevTools
- [ ] Clear console before testing

### Core Tests (MUST PASS)
- [ ] Test Case 1: Navigate to categories
- [ ] Test Case 2: Open flat category
- [ ] Test Case 3: Click Add Item
- [ ] Test Case 4: Search items
- [ ] Test Case 5: Portioned price range
- [ ] Test Case 6: Simple item price
- [ ] Test Case 7: Combo item price
- [ ] Test Case 8: Mixed item selection
- [ ] Test Case 9: Add items (NO toFixed errors!)
- [ ] Test Case 10: Items listed individually
- [ ] Test Case 11: Portioned price on category page
- [ ] Test Case 12: Simple price on category page
- [ ] Test Case 13: Remove items
- [ ] Test Case 14: No console errors

### Edge Cases (MUST PASS)
- [ ] Edge Case 1: No price (undefined/null)
- [ ] Edge Case 2: Empty portionPrices array
- [ ] Edge Case 3: Single portion
- [ ] Edge Case 4: No combo base price
- [ ] Edge Case 5: **NaN price (CRITICAL FIX!)**
- [ ] Edge Case 6: Infinity price
- [ ] Edge Case 7: Negative price
- [ ] Edge Case 8: String price
- [ ] Edge Case 9: Large price
- [ ] Edge Case 10: Small decimal price

### Day-Wise Tests (MUST PASS)
- [ ] Test Case 15: Open day-wise category
- [ ] Test Case 16: **ItemSequenceDialog (CRITICAL BUG FIX!)**
- [ ] Test Case 17: Prices in ItemSequenceDialog
- [ ] Test Case 18: Item reordering
- [ ] Test Case 19: Switch days

### Regression Tests (MUST PASS)
- [ ] Regression Test 1: Existing categories
- [ ] Regression Test 2: Food items page
- [ ] Regression Test 3: Other price displays

### Browser Tests
- [ ] Chrome: All core tests pass
- [ ] Firefox: All core tests pass
- [ ] Safari: All core tests pass
- [ ] Edge: All core tests pass

---

## Expected Test Results Summary

### SUCCESS CRITERIA

✅ **Primary Goal**: NO "Cannot read properties of undefined (reading 'toFixed')" errors anywhere

✅ **All Price Displays Work**:
- Simple items: Show single price correctly
- Portioned items: Show price range correctly
- Combo items: Show base price or "N/A"
- Invalid prices: Show "$0.00" or "N/A" without errors

✅ **All Operations Functional**:
- Add items to categories
- Remove items from categories
- Search and filter items
- View items in categories
- Reorder items (day-wise)

✅ **No Regressions**:
- Existing functionality maintained
- No new bugs introduced
- All pages work correctly

---

## Bug Fix Verification Code

### Code Review Checklist

**File: ItemSequenceDialog.tsx Line 465**

BEFORE (BUGGY):
```typescript
${item.price.toFixed(2)}
```

AFTER (FIXED):
```typescript
{safeFormatCurrency(item.price)}
```

**Verification Points**:
- [ ] Line 465 uses safeFormatCurrency instead of .toFixed(2)
- [ ] Import statement includes safeFormatCurrency from '@/utils/currency'
- [ ] No other instances of direct .toFixed() calls on prices in the file
- [ ] Validation handles all edge cases (null, undefined, NaN, Infinity)

**File: AddItemDialog.tsx Lines 426-437**

**Verification Points**:
- [ ] Uses safeFormatCurrency for all price displays
- [ ] Portion items: safeFormatCurrency(Math.min(...item.portionPrices))
- [ ] Simple items: safeFormatCurrency(item.price)
- [ ] Null/undefined checks before accessing portionPrices
- [ ] Array length check before Math.min/max

**File: category/items/page.tsx Lines 587-598**

**Verification Points**:
- [ ] Uses safeFormatCurrency for price display
- [ ] Portioned items show range with safeFormatCurrency
- [ ] Simple items show single price with safeFormatCurrency
- [ ] Proper null/undefined/NaN handling

---

## Test Report Template

### Test Execution Report

**Date**: ___________________
**Tester**: ___________________
**Environment**: (Dev/Staging/Prod)
**Browser**: ___________________

#### Test Results Summary
- Total Tests: ____
- Passed: ____
- Failed: ____
- Skipped: ____

#### Failed Tests Details
1. Test Case #: _________
   - Issue: ___________________
   - Screenshot: _____________

2. Test Case #: _________
   - Issue: ___________________
   - Screenshot: _____________

#### Edge Cases Results
- NaN Price: [ ] Pass [ ] Fail
- Infinity Price: [ ] Pass [ ] Fail
- Empty portionPrices: [ ] Pass [ ] Fail
- No Price: [ ] Pass [ ] Fail

#### Console Errors Found
- Error 1: ___________________
- Error 2: ___________________
- Error 3: ___________________

#### Overall Assessment
- [ ] READY FOR PRODUCTION
- [ ] NEEDS FIXES
- [ ] CRITICAL ISSUES FOUND

#### Notes
_________________________________
_________________________________
_________________________________

---

## Sign-Off Criteria

### Ready for Merge When:
✅ All core test cases pass
✅ All edge case tests pass
✅ Zero console errors during testing
✅ No regressions detected
✅ All browser compatibility tests pass
✅ Code review approved
✅ Performance acceptable

### Critical Blockers:
❌ ANY toFixed error in console
❌ ANY crash or hang during operations
❌ Prices not displaying correctly
❌ Items cannot be added/removed
❌ Regression in existing features

---

## Quick Smoke Test (5 Minutes)

### Fast Verification
1. Open food categories page ✅
2. Open a flat category ✅
3. Click "Add Item" ✅
4. Verify price displays (simple, portions, combo) ✅
5. Add 3 items (mixed types) ✅
6. Check console: NO toFixed errors ✅
7. View items in category ✅
8. Remove 1 item ✅
9. Open a day-wise category ✅
10. Open ItemSequenceDialog ✅
11. **CRITICAL: Check for toFixed error** ✅
12. Verify item prices in dialog ✅
13. Close and reopen to confirm fix ✅

**Result**: [ ] PASS [ ] FAIL

---

## Conclusion

This comprehensive test scenario covers:
- ✅ All user workflows for food category management
- ✅ All item types and price display formats
- ✅ Critical edge cases that cause toFixed errors
- ✅ Both flat and day-wise categories
- ✅ The specific bug location (ItemSequenceDialog)
- ✅ Regression testing
- ✅ Browser compatibility
- ✅ Performance considerations

**The fix must ensure that safeFormatCurrency is used instead of direct .toFixed() calls on all price values, particularly in ItemSequenceDialog.tsx line 465.**

This test scenario will verify that the bug is completely fixed and no regressions are introduced.
