# Testing Guide - Cosmetic Fields Update

## Quick Start Testing

### 1. Start the Frontend Admin
```bash
cd D:\veylog-fronend-admin
npm run dev
```

### 2. Navigate to Products
- Login to admin panel
- Click "Products" in sidebar
- Click "New Product" or edit existing product

---

## Test Cases

### ✅ Test Case 1: Create New Product with Cosmetic Fields

**Steps:**
1. Click "New Product"
2. Fill basic info:
   - Name: "Hydrating Hyaluronic Acid Serum"
   - Subtitle: "Intensive moisture boost for all skin types"
   - Short description: "A lightweight daily serum..."
3. Scroll to **Product Attributes**:
   - Benefits: `Hydrating, Plumping, Smoothing`
   - Skin Types: `Dry, Normal, Combination, Oily`
   - Skin Concerns: `Dehydration, Fine Lines, Dullness`
   - Finish: Select "Dewy"
   - Formulation Type: `Serum`
   - pH Level: `5.5-6.5`
   - Absorption Rate: Select "Fast"
4. Scroll to **Ingredients**:
   - Click "Add Ingredient"
   - Name: `Hyaluronic Acid`
   - Percentage: `2%`
   - Purpose: `Hydration`
   - Click "Add Ingredient" again
   - Name: `Vitamin B5`
   - Percentage: `1%`
   - Purpose: `Soothing`
   - Ingredient Highlights: `Powered by multi-weight hyaluronic acid`
   - Free From: `Parabens, Sulfates, Phthalates, Mineral Oil`
5. Scroll to **Certifications**:
   - Click "Add Certification"
   - Type: `Cruelty-Free`
   - Authority: `Leaping Bunny`
   - Year: `2023`
   - Click "Add Certification"
   - Type: `Vegan`
   - Authority: `Vegan Society`
   - Year: `2023`
   - Claims: `Dermatologist Tested, Allergy Tested`
   - Check ☑ Hypoallergenic
   - Check ☑ Non-Comedogenic
   - Pregnancy Safe: Select "Safe"
6. Scroll to **Usage & Performance**:
   - Usage Instructions: `Apply 2-3 drops to clean, damp skin morning and evening. Follow with moisturizer.`
   - Application Method: `Fingertips or palms`
   - Usage Frequency: `Daily AM & PM`
   - Results Timeline: `Immediate hydration boost. Plumper, smoother skin in 2-4 weeks`
   - Clinical Study Summary: `In a 4-week clinical study, 92% of users reported improved hydration.`
   - Check ☑ Has Before/After Study
7. Scroll to **Sensory Attributes**:
   - Texture Description: `Lightweight, gel-like serum that glides smoothly`
   - Color Description: `Clear, transparent gel`
   - Feel on Skin: `Cooling, non-sticky, absorbs quickly`
8. Scroll to **Packaging & Sustainability**:
   - Packaging Type: `Glass Dropper Bottle`
   - Packaging Material: `100% Recyclable Glass, 50% PCR Plastic Cap`
   - Check ☑ Recyclable
   - Check ☑ Eco-Friendly
9. Scroll to **Demographics & Marketing**:
   - Age Range: `All Ages`
   - Gender Target: Select "Unisex"
   - Tutorial Video URL: `https://youtube.com/watch?v=example`
10. Click **Save**

**Expected Result:**
- ✅ Product saves successfully
- ✅ Toast message: "Product created."
- ✅ Redirects to product edit page with ID
- ✅ All fields populated with entered data

---

### ✅ Test Case 2: Edit Existing Product

**Steps:**
1. Open existing product
2. Scroll to new cosmetic sections
3. Add data to empty fields
4. Click Save

**Expected Result:**
- ✅ Product updates successfully
- ✅ Toast message: "Changes saved."
- ✅ New fields saved to database
- ✅ Existing data unchanged

---

### ✅ Test Case 3: Repeater Fields

#### Test Key Ingredients
1. Click "Add Ingredient" (starts empty)
2. Fill first ingredient
3. Click "Add Ingredient" again
4. Fill second ingredient
5. Click delete (×) on first ingredient
6. Save product

**Expected Result:**
- ✅ Can add multiple ingredients
- ✅ Can delete specific ingredient
- ✅ Remaining ingredients maintained
- ✅ Data saves as JSON array

#### Test Certifications
1. Click "Add Certification"
2. Fill type, authority, year
3. Click "Add Certification" again
4. Fill second certification
5. Click delete on first
6. Save

**Expected Result:**
- ✅ Multiple certifications work
- ✅ Delete works correctly
- ✅ Data saves as JSON array

#### Test Awards
1. Click "Add Award"
2. Fill name, authority, year
3. Save

**Expected Result:**
- ✅ Award saves correctly
- ✅ Data as JSON array

#### Test Press Features
1. Click "Add Press Feature"
2. Fill publication, date, URL
3. Save

**Expected Result:**
- ✅ Press feature saves
- ✅ Data as JSON array

---

### ✅ Test Case 4: Conditional Fields

#### Test Seasonal Field
1. Check ☑ Seasonal Product
2. **Expected:** Season dropdown appears
3. Select a season
4. Uncheck ☐ Seasonal Product
5. **Expected:** Season dropdown hides
6. Save

**Expected Result:**
- ✅ Conditional field shows/hides
- ✅ Season saves when seasonal is checked

#### Test Sample Field
1. Check ☑ Sample Product
2. **Expected:** Sample of Product ID field appears
3. Enter product ID: `123`
4. Uncheck ☐ Sample Product
5. **Expected:** Field hides
6. Save

**Expected Result:**
- ✅ Conditional field works
- ✅ Product ID saves when sample is checked

---

### ✅ Test Case 5: CSV Fields

#### Test Benefits
1. Enter: `Hydrating, Anti-Aging, Brightening`
2. Save
3. Reload product

**Expected Result:**
- ✅ CSV converts to array: `["Hydrating", "Anti-Aging", "Brightening"]`
- ✅ On load, converts back to CSV for editing

#### Test Skin Types
1. Enter: `Dry, Normal, Combination`
2. Save and reload

**Expected Result:**
- ✅ Array conversion works
- ✅ Editable as CSV

---

### ✅ Test Case 6: Dropdowns

Test all dropdowns have correct options:

**Finish:**
- [ ] Matte
- [ ] Dewy
- [ ] Natural
- [ ] Satin
- [ ] Radiant
- [ ] Luminous

**Coverage:**
- [ ] Sheer
- [ ] Light
- [ ] Medium
- [ ] Full
- [ ] Buildable

**Absorption Rate:**
- [ ] Instant
- [ ] Fast
- [ ] Medium
- [ ] Slow

**Pregnancy Safe:**
- [ ] Safe
- [ ] Consult Doctor
- [ ] Not Recommended

**Gender Target:**
- [ ] Unisex
- [ ] Female
- [ ] Male
- [ ] Non-Binary

**Season:**
- [ ] Spring
- [ ] Summer
- [ ] Fall
- [ ] Winter
- [ ] All Year

---

### ✅ Test Case 7: Checkboxes

Test all boolean flags:

**Certifications Section:**
- [ ] Hypoallergenic
- [ ] Non-Comedogenic

**Packaging Section:**
- [ ] Recyclable
- [ ] Refillable
- [ ] Eco-Friendly
- [ ] Carbon Neutral

**Demographics Section:**
- [ ] Seasonal Product
- [ ] Limited Edition
- [ ] Sample Product

**Performance Section:**
- [ ] Has Before/After Study

---

### ✅ Test Case 8: Form Validation

1. Try to save with empty required fields
2. **Expected:** Error message appears
3. Fill required fields
4. Save

**Expected Result:**
- ✅ Validation works
- ✅ Error messages clear
- ✅ Form submits after fixing

---

### ✅ Test Case 9: Data Persistence

1. Create product with ALL new fields filled
2. Save
3. Navigate away
4. Return to product edit page
5. Verify all fields populated

**Expected Result:**
- ✅ All simple fields load
- ✅ All repeater items load
- ✅ All checkboxes load
- ✅ All dropdowns load
- ✅ No data loss

---

### ✅ Test Case 10: Backend API Response

**Check browser Network tab:**
1. Open DevTools → Network
2. Save product
3. Find POST/PUT request to `/products`
4. Check Request Payload

**Expected Payload Structure:**
```json
{
  "name": "Hydrating Serum",
  "benefits_array": ["Hydrating", "Anti-Aging"],
  "skin_types": ["Dry", "Normal"],
  "key_ingredients": [
    {
      "name": "Hyaluronic Acid",
      "percentage": "2%",
      "purpose": "Hydration"
    }
  ],
  "certifications": [
    {
      "type": "Cruelty-Free",
      "authority": "Leaping Bunny",
      "year": 2023
    }
  ],
  "is_hypoallergenic": true,
  "is_non_comedogenic": true,
  "coverage": "medium",
  "finish": "Dewy",
  // ... etc
}
```

**Expected Response:**
- ✅ Status 200/201
- ✅ Product object returned
- ✅ New fields present in response

---

## Browser Testing

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Responsive Testing

Test on different screen sizes:

### Desktop (1920x1080)
- [ ] Layout: 2 columns
- [ ] All fields visible
- [ ] No overflow

### Tablet (768x1024)
- [ ] Layout: Single column
- [ ] Cards stack vertically
- [ ] Touch-friendly

### Mobile (375x667)
- [ ] Full width layout
- [ ] Scrollable
- [ ] Fields stack properly
- [ ] Buttons accessible

---

## Performance Testing

1. **Form Load Time:**
   - Open product with all fields
   - Measure load time
   - **Target:** < 1 second

2. **Save Time:**
   - Save product with all fields
   - Measure response time
   - **Target:** < 2 seconds

3. **Repeater Performance:**
   - Add 10+ ingredients
   - Add/delete items
   - **Expected:** No lag

---

## Common Issues & Solutions

### Issue: Form not saving
**Solution:**
- Check browser console for errors
- Verify backend is running
- Check network tab for failed requests

### Issue: Repeater fields not working
**Solution:**
- Verify state updates correctly
- Check array manipulation in handlers
- Ensure keys are unique

### Issue: Conditional fields not showing
**Solution:**
- Check checkbox state
- Verify conditional rendering logic
- Console.log form state

### Issue: Dropdowns showing wrong values
**Solution:**
- Verify enum values match backend
- Check MenuItem values
- Ensure controlled component pattern

---

## Debugging Tips

### View Form State
Add to component:
```typescript
useEffect(() => {
  console.log('Form State:', form)
}, [form])
```

### View Payload Before Submit
Add before save:
```typescript
console.log('Payload:', payload)
```

### View API Response
Check Network tab → Response tab

---

## Success Criteria

✅ All new sections visible  
✅ All fields editable  
✅ Repeater fields add/remove correctly  
✅ Conditional fields show/hide  
✅ CSV fields parse correctly  
✅ Dropdowns have correct options  
✅ Checkboxes toggle properly  
✅ Form saves successfully  
✅ Data persists after save  
✅ Backend receives correct payload  
✅ No console errors  
✅ Responsive on all devices  

---

## Next: Product List Filters

After testing the form, add filters to ProductsListPage.tsx:
- Filter by skin type
- Filter by benefits
- Filter by certifications
- Filter by sustainability flags
- Filter by finish/coverage

---

**Happy Testing! 🧪**
