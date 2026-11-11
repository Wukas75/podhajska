# Working rules for podhajska

Website of Štúdiá Podhájska (adults-only accommodation), live at
https://www.podhajska.net. The site and its hosting belong to a client, not to
the owner of this repository; the owner builds and maintains it for them.

## Talking to the owner

- Reply in Slovak. Code, comments, commit messages and PR descriptions stay in English.
- **CAP** means "commit and push": the approval to commit and push what was
  just shown. Do not commit or push without it.
- The main branch is `main`.

## What is live

- Production is the **PHP version** in `web/websupport/` (PHP 8.2, MySQL 8.4 at
  Websupport) together with the static files in `web/public/`. Its README
  describes the API, cron and deployment.
- The Cloudflare Pages version (`web/functions/`, D1, R2, `wrangler.toml`) is the
  older implementation. podhajska.pages.dev only redirects to www now. Do not
  build new features there unless the owner asks.
- `mobile/` and `supabase/` are an old, unrelated brewing app; leave them alone.

## Deploying

- Pushing does not deploy. Deployment is a manual SFTP upload with
  `web/websupport/dev/deploy.mjs`, run by the owner's machine with credentials
  the owner gives; they are never stored in the repository.
- `dev/config.*.php` and other files with passwords are gitignored; never commit them.
- Production data (bookings, articles, gallery, admin account) is changed only
  when the owner asks.

## Booking calendar

- Three rooms; bookings sync both ways with Booking.com through `.ics`
  (`/ics/<room>.ics` export, per-room import URL). `end_date` is the day of
  departure and is exclusive. Bookings that came from Booking.com
  (`source = 'booking'`) are never exported back and are managed in Booking.com.
- Reservation e-mails go to and from info@podhajska.net.

## Testing

- Locally: Docker compose in `web/websupport/dev/` (Apache + PHP + MariaDB),
  then `install.php?token=tok` and `node e2e.mjs`. Without Docker (for example
  in a cloud session) the e2e tests cannot run; say so instead of skipping silently.
- When testing with Slovak diacritics, send JSON payloads from a file, not inline.
