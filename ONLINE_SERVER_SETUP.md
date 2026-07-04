# Yaser Mall Stock - Always Online Server

Use this when you want the employee and admin app to work even if your PC is off.

## Best Option: Render

1. Create or open your Render account:
   https://render.com

2. Upload this project folder to GitHub.

3. In Render, choose:
   **New +** -> **Blueprint**

4. Connect the GitHub repository that contains this project.

5. Render will read `render.yaml` and create:
   - `yaser-mall-stock` web app
   - `yaser-mall-stock-db` PostgreSQL database

6. Wait for deploy to finish.

7. Open the permanent links:
   - Employee: `https://YOUR-RENDER-LINK/employee`
   - Admin: `https://YOUR-RENDER-LINK/admin/items`
   - Dashboard: `https://YOUR-RENDER-LINK/dashboard`

## Logins

Admin:
- Email: `admin@yasermall.local`
- Password: `Admin123!`

Supervisor:
- Email: `supervisor@yasermall.local`
- Password: `Supervisor123!`

Employee:
- Email: `employee@yasermall.local`
- Password: `Employee123!`

## Important

- The old Cloudflare quick link only works while your PC is on.
- The Render link works online even when your PC is off.
- Keep `DATABASE_URL` connected to the Render PostgreSQL database.
- The deploy command runs database migration and creates the user accounts automatically.
- If users are missing after the first deploy, run the seed command once from Render shell:

```bash
npm run db:seed
```

## Render Commands

Build command:

```bash
npm ci && npx prisma generate && npx prisma migrate deploy && npm run db:seed && npm run build
```

Start command:

```bash
npm run start -- -p $PORT
```
