import { Client } from "basic-ftp"
import { config as loadEnv } from "dotenv"
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Manca ${name} nel file .env`)
  return value
}

function phpString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

function normalizeRemoteDir(input: string): string {
  const trimmed = input.trim().replace(/\\/g, "/")
  if (!trimmed || trimmed.includes("..")) {
    throw new Error(
      "FTP_REMOTE_DIR deve essere una sottocartella e non può contenere '..'.",
    )
  }
  const normalized = trimmed.replace(/^\/+|\/+$/g, "")
  if (!normalized || normalized === "." || normalized === "public_html") {
    throw new Error(
      "FTP_REMOTE_DIR deve essere la sottocartella dell'app. Non svuoto la root dell'hosting.",
    )
  }
  return normalized
}

function rewriteBase(): string {
  const value = process.env.APP_BASE_PATH?.trim() || "/"
  const withLeading = value.startsWith("/") ? value : `/${value}`
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
}

function htaccess(base: string): string {
  return `RewriteEngine On
RewriteBase ${base}

<Files "config.php">
  Require all denied
</Files>

RewriteRule ^api/ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
`
}

function configPhp(): string {
  const driver = process.env.DB_DRIVER?.trim() || "mysql"
  if (driver === "mysql") {
    required("DB_HOST")
    required("DB_NAME")
    required("DB_USER")
    if (process.env.DB_PASSWORD === undefined)
      throw new Error("Manca DB_PASSWORD nel file .env")
  }
  return `<?php
declare(strict_types=1);
return [
  'DB_DRIVER' => ${phpString(driver)},
  'DB_HOST' => ${phpString(process.env.DB_HOST ?? "localhost")},
  'DB_PORT' => ${phpString(process.env.DB_PORT ?? "3306")},
  'DB_NAME' => ${phpString(process.env.DB_NAME ?? "")},
  'DB_USER' => ${phpString(process.env.DB_USER ?? "")},
  'DB_PASSWORD' => ${phpString(process.env.DB_PASSWORD ?? "")},
  'DB_SQLITE_PATH' => ${phpString(process.env.DB_SQLITE_PATH ?? "storage/dashboard.sqlite")},
];
`
}

function prepareStaging(): string {
  const dist = join(root, "dist")
  try {
    readdirSync(dist)
  } catch {
    throw new Error("Manca dist/. Esegui prima npm run build.")
  }
  const staging = join(root, "storage", "deploy-staging")
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  cpSync(dist, staging, { recursive: true })
  const api = join(staging, "api")
  mkdirSync(api, { recursive: true })
  cpSync(join(root, "server", "bootstrap.php"), join(api, "bootstrap.php"))
  cpSync(join(root, "server", "layout.php"), join(api, "layout.php"))
  writeFileSync(join(api, "config.php"), configPhp())
  writeFileSync(join(staging, ".htaccess"), htaccess(rewriteBase()))
  return staging
}

async function main(): Promise<void> {
  loadEnv({ path: join(root, ".env") })
  const host = required("FTP_HOST")
  const user = required("FTP_USER")
  const password = required("FTP_PASSWORD")
  const port = Number(process.env.FTP_PORT || "21")
  const secure = (process.env.FTP_SECURE ?? "true").trim() !== "false"
  const remoteDir = normalizeRemoteDir(required("FTP_REMOTE_DIR"))
  const staging = prepareStaging()

  const client = new Client(30_000)
  try {
    await client.access({ host, port, user, password, secure })
    await client.ensureDir(remoteDir)
    const existing = await client.list()
    console.log(`Rimuovo ${existing.length} elementi da ${remoteDir}`)
    await client.clearWorkingDir()
    await client.uploadFromDir(staging)
    console.log(`Deploy completato in ${remoteDir}`)
  } finally {
    client.close()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
