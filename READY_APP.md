# Yaser Mall Stock Ready App

## Employee Mobile App

Open:

`http://localhost:3000/employee`

Login:

- Email: `employee@yasermall.local`
- Password: `YaserMall@2026`

Every item shows:

- product image
- product ID
- English name
- Arabic name
- price in JOD
- main category
- subcategory
- brand
- `In Stock` button
- `Out Stock` button

## Admin Item Plan

Open:

`http://localhost:3000/admin/items`

Login:

- Email: `admin@yasermall.local`
- Password: `YaserMall@2026`

Admin sees each item with product ID, photo, English/Arabic names, JOD price, main category, subcategory, latest status, and employee name.

## After This Update

Because product fields were added, run:

`npx prisma migrate dev --name add-product-categories`

Then seed:

`npm run db:seed`

Then restart:

`npm run dev`
