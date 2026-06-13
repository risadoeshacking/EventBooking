# EventSpace Premium Redesign — TODO

## 1. Cinematic full-screen calendar interaction

- [ ] Update `frontend/hall-calendar.html` to add:
  - [ ] Availability panel container
  - [ ] Inline booking card container
  - [ ] Account-choice modal markup (create account vs guest)
  - [ ] Cinematic overlay elements (blur/fade layer)
- [ ] Implement cinematic zoom + blur + availability reveal in `frontend/js/hall-calendar.js`
- [ ] On booking creation success: update booked dates instantly (no refresh)

## 2. Premium palette + required calendar date states

- [ ] Replace/align variables in `frontend/css/calendar-premium.css` to:
  - Primary deep maroon (#6B0F1A)
  - Accent soft gold (#F5C542)
  - Charcoal text contrast
- [ ] Implement required states:
  - [ ] AVAILABLE hover elevation + subtle maroon accent
  - [ ] BOOKED locked icon + gold “Booked” label + disabled click
  - [ ] TODAY gold border + glow
- [ ] Remove any leakage of default FullCalendar styling

## 3. Account + booking inline submission

- [ ] Modify/extend `frontend/js/hall-calendar.js` to submit booking via existing `/api/bookings` endpoint
- [ ] Add guest vs registered behavior:
  - [ ] If logged in → link to account
  - [ ] If guest → submit with guest fields only
- [ ] Ensure UI matches minimal premium booking card fields

## 4. Admin UX (block/unblock)

- [ ] Verify admin pages support manual block/unblock and calendar refresh behavior

## 5. Testing

- [ ] Run backend and open the calendar page
- [ ] Validate cinematic transitions and booking updates instantly
