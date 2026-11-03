# Dashboardy

A grid dashboard you can use with a mouse or with touch. Widgets can be dragged and resized, and they stay where you leave them after a refresh. There is no login: each browser keeps its own copy.

## Requirements

- Node.js 20 or later
- pnpm 10
- PHP 8.1 or later, with PDO SQLite locally and PDO MySQL on the host
- An FTP account and a MySQL database on [Netsons](https://www.netsons.com), only when you want to publish

## Local start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite serves the interface and forwards `/api` to the PHP server on `127.0.0.1:8080`. The local database is the SQLite file `storage/dashboard.sqlite`, created on the first save. If PHP cannot be reached, the dashboard stays usable from the copy in `localStorage`.

## Scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Starts Vite and the PHP API                                      |
| `pnpm typecheck`    | `tsc --noEmit`                                                   |
| `pnpm lint`         | ESLint                                                           |
| `pnpm format`       | Rewrites files with Prettier                                     |
| `pnpm format:check` | Checks Prettier without rewriting                                |
| `pnpm knip`         | Unused files and exports                                         |
| `pnpm circular`     | Circular dependencies with madge                                 |
| `pnpm ci`           | Runs typecheck, lint, format:check, knip, and circular, in order |
| `pnpm build`        | Production build, with the `APP_BASE_PATH` prefix                |
| `pnpm deploy`       | Empties the FTP folder and uploads the build just produced       |
| `pnpm bad`          | `ci`, then `build`, then `deploy`                                |

`ci` also runs on its own in two places:

- before a push, through the Husky hook `.husky/pre-push`
- on GitHub, on every push to the `main` branch (`.github/workflows/ci.yml`)

Deploy does not run on GitHub. FTP and database passwords stay in the local `.env`.

## Grid

The page is an invisible grid with an even number of columns. An iPhone Pro Max shows four in portrait and eight in landscape; an iPad mini shows six and eight; a 9.7″ iPad shows eight in portrait. Larger iPads and desktops follow the same proportion. Cell count and cell size live in `src/grid/metrics.ts`.

The page has 12px of padding below 768px and 24px above it. Cells are 12px apart. Corner radius is about 14% of the side, so the proportions stay the same on every screen.

Cells stay transparent. During a drag or a resize they turn gray over 250ms. If the pointer rests for two seconds on an empty cell, that cell shows a plus and opens the widget menu. On touch, a press of about 350ms on an empty area opens the same menu.

This demo has six widgets, all in grayscale. Compact has only four fixed sizes. Wide runs from 3 columns up to the full row, and from 2 to 5 rows. Free and Square can grow up to the screen: the maximum width is the number of columns in the row, and the maximum height is the number of rows that fit on one screen. Horizontal stays wider than it is tall, and Vertical stays taller than it is wide. Packing no longer closes the gaps: each widget stays in the cell where it is dropped, even when empty rows sit around it. If the screen has fewer columns, widgets that do not fit wrap in reading order, from the top left, without rewriting the saved positions. A widget with no legal size on that grid — for example a banner at least ten columns wide, opened on a phone — is not drawn, and the widgets after it take the space. It stays in the document: on a large enough screen it returns to where it was. Moves start together and can cross. Below the last widget there is at most one empty screen. During a drag the page does not scroll and does not grow.

A widget’s inner padding equals the grid gap. The padding background is the page background; the body uses the gray of its type. The outer shadow is short and built from several layers.

With a mouse, a drag starts at once from the widget body, which lifts slightly. If the pointer rests for half a second in the padding, the curved bottom corners and the delete button appear. Resize snaps to the allowed sizes and, on release, the widget keeps the size already shown. If the new footprint covers other widgets, those move to the right or onto the row below.

On touch, a press of about 350ms in the center drags, a press on the bottom edge resizes, and a press on the top edge shows the controls.

## Publishing on Netsons

Netsons uses cPanel and Apache. The public folder of the main domain is `public_html`. PHP and MySQL run on the same machine: from PHP the database host is `localhost`, port `3306`. Database and user names created in cPanel carry the account prefix, for example `account_dashboard` and `account_dash`. Remote MySQL access is not required.

1. In cPanel → MySQL Databases, create the database and the user, then assign the user to the database with all privileges. The `layouts` table is created by the first request to the API.
2. In cPanel → MultiPHP Manager, set PHP 8.1 or later for the domain.
3. In the production `.env`, set:
   - `APP_BASE_PATH=/dashboard/` if the site should live at `https://domain/dashboard/`
   - `FTP_HOST` to the server name shown in cPanel, port `21`
   - `FTP_USER` and `FTP_PASSWORD`
   - `FTP_REMOTE_DIR=public_html/dashboard`, or only `dashboard` if the FTP user is already confined to `public_html`
   - `DB_DRIVER=mysql`, `DB_HOST=localhost`, plus the database name, user, and password
4. Run `pnpm bad`.

Every deploy deletes everything inside `FTP_REMOTE_DIR`, then uploads `index.html`, the assets, `api/`, and `.htaccess`. It leaves folders outside that path alone, and it refuses to empty `public_html` by itself. The script runs only after `ci` and `build` have succeeded. If the upload is interrupted, the folder can stay empty until the next deploy.

The generated `.htaccess` uses `RewriteBase` with `APP_BASE_PATH`, lets `api/` through, and sends every other route to `index.html`. `config.php` cannot be downloaded from the browser.
