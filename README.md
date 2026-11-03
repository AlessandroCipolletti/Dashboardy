# Dashboardy

Dashboard a griglia, usabile con mouse e touch. I widget si trascinano, si ridimensionano e restano dove li lasci dopo un refresh. Non c’è login: ogni browser ha una propria copia.

## Requisiti

- Node.js 20 o successivo
- pnpm 10
- PHP 8.1 o successivo, con PDO SQLite in locale e PDO MySQL sull’hosting
- Un account FTP e un database MySQL su [Netsons](https://www.netsons.com) solo quando vuoi pubblicare

## Avvio locale

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Apri `http://127.0.0.1:5173`. Vite serve l’interfaccia e inoltra `/api` al server PHP su `127.0.0.1:8080`. Il database locale è il file SQLite `storage/dashboard.sqlite`, creato al primo salvataggio. Se PHP non è raggiungibile, la dashboard resta utilizzabile con la copia in `localStorage`.

## Script

| Script              | Cosa fa                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm dev`          | Avvia Vite e l’API PHP                                            |
| `pnpm typecheck`    | `tsc --noEmit`                                                    |
| `pnpm lint`         | ESLint                                                            |
| `pnpm format`       | Riscrive i file con Prettier                                      |
| `pnpm format:check` | Controlla Prettier senza riscrivere                               |
| `pnpm knip`         | File ed export non usati                                          |
| `pnpm circular`     | Dipendenze circolari con madge                                    |
| `pnpm ci`           | Esegue nell’ordine typecheck, lint, format:check, knip e circular |
| `pnpm build`        | Build di produzione, con il prefisso `APP_BASE_PATH`              |
| `pnpm deploy`       | Svuota la cartella FTP e carica la build appena fatta             |
| `pnpm bad`          | `ci`, poi `build`, poi `deploy`                                   |

`ci` parte da solo in due punti:

- prima di un push, tramite il hook Husky `.husky/pre-push`
- su GitHub, a ogni push sul branch `main` (`.github/workflows/ci.yml`)

Il deploy non gira su GitHub. Le password FTP e del database restano nel `.env` locale.

## Griglia

La pagina è una griglia invisibile, con un numero pari di colonne. Su un telefono in verticale sono due, in orizzontale quattro; su un desktop largo se ne vedono molte di più. Il numero e la dimensione delle celle stanno in `src/grid/metrics.ts`.

Intorno alla pagina c’è un padding di 12px sotto i 768px e di 24px sopra. Tra le celle ci sono 12px. Il raggio degli angoli è circa il 14% del lato, così le proporzioni restano uguali su ogni schermo.

Le celle restano trasparenti. Durante un trascinamento o un ridimensionamento diventano grigie in 250ms. Se il mouse resta fermo due secondi su una cella vuota, quella cella mostra un più e apre il menu dei widget. Su touch, una pressione di circa 350ms su una zona vuota apre lo stesso menu.

I widget di questa demo sono sei, tutti in scala di grigi, e ognuno accetta solo alcune misure: Compatto, Ampio, Libero, Orizzontale, Verticale, Quadrato. L’ordine non compatta più i buchi: ogni widget resta nella cella in cui viene lasciato, anche se intorno ci sono righe vuote. Sotto l’ultimo widget c’è al massimo una schermata vuota. Durante il trascinamento la pagina non scorre e non si allunga.

Il padding interno di un widget è uguale al gap della griglia. Lo sfondo del padding è quello della pagina; la pancia ha il grigio del tipo. L’ombra esterna è corta e fatta da più livelli.

Con il mouse, il trascinamento parte subito dalla pancia del widget, che si solleva un poco. Se il puntatore resta fermo mezzo secondo nel padding compaiono gli angoli curvi in basso e il pulsante per eliminare. Il resize si aggancia alle misure consentite e, al rilascio, il widget resta sulla misura già mostrata. Se il nuovo ingombro copre altri widget, quelli si spostano a destra o sulla riga sotto.

Su touch, una pressione di circa 350ms al centro trascina, sul bordo inferiore ridimensiona, sul bordo superiore mostra i controlli.

## Pubblicare su Netsons

Netsons usa cPanel e Apache. La cartella pubblica del dominio principale è `public_html`. PHP e MySQL stanno sulla stessa macchina: dal PHP il host del database è `localhost`, porta `3306`. I nomi di database e utente creati nel cPanel hanno il prefisso dell’account, per esempio `account_dashboard` e `account_dash`. L’accesso MySQL remoto non serve.

1. In cPanel → Database MySQL crea il database, l’utente e associa l’utente al database con tutti i privilegi. La tabella `layouts` viene creata dalla prima richiesta all’API.
2. In cPanel → MultiPHP Manager imposta PHP 8.1 o successivo per il dominio.
3. Nel `.env` di produzione imposta:
   - `APP_BASE_PATH=/dashboard/` se il sito deve vivere in `https://dominio/dashboard/`
   - `FTP_HOST` con il nome server letto in cPanel, porta `21`
   - `FTP_USER` e `FTP_PASSWORD`
   - `FTP_REMOTE_DIR=public_html/dashboard`, oppure solo `dashboard` se l’utente FTP è già confinato in `public_html`
   - `DB_DRIVER=mysql`, `DB_HOST=localhost`, e nome, utente e password del database
4. Lancia `pnpm bad`.

Ogni deploy cancella tutto il contenuto di `FTP_REMOTE_DIR` e poi carica `index.html`, gli asset, `api/` e `.htaccess`. Non tocca le cartelle fuori da quel percorso, e si rifiuta di svuotare `public_html` da sola. Lo script parte solo dopo che `ci` e `build` sono riusciti. Se l’upload si interrompe, la cartella può restare vuota fino al deploy successivo.

L’`.htaccess` generato usa `RewriteBase` con `APP_BASE_PATH`, lascia passare `api/` e rimanda le altre rotte a `index.html`. `config.php` non è scaricabile dal browser.
