# Online Admin Deployment

The app already uses Supabase as the shared backend. That means the iOS app and the online admin panel can work against the same live data.

## Free Web Admin

Use either Vercel or Netlify and connect the GitHub repository.

### Vercel

- Framework preset: Other
- Build command: `npm run build:web`
- Output directory: `dist`

The repository includes `vercel.json`, so Vercel should pick these settings automatically.

### Netlify

- Build command: `npm run build:web`
- Publish directory: `dist`

The repository includes `netlify.toml`, so Netlify should pick these settings automatically.

## Admin URL

After deployment, open:

```text
https://your-domain/admin
```

The admin account is controlled by `ADMIN_EMAIL` in `store/adminStore.ts`. Data syncs through Supabase, so changes made online are visible to the iOS app and local app after sync/load.

## iOS / App Store

The iOS bundle is configured in `app.json`:

```text
com.psychotechniplus.app
```

App Store Connect submit settings are in `eas.json`, currently targeting App Store Connect app ID:

```text
6776568241
```

Apple distribution still requires an active Apple Developer Program account.
