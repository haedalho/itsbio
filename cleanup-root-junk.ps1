$projectRoot = "C:\itsbio-site\itsbio"
Set-Location $projectRoot

$allowed = @(
  ".cache",
  ".gitignore",
  "README.md",
  "app",
  "backups",
  "categories-export.json",
  "components",
  "context_dump.bat",
  "data",
  "eslint.config.mjs",
  "kent-run.log",
  "lib",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "products-export.json",
  "public",
  "scripts",
  "studio-admin",
  "tmp",
  "tsconfig.json"
)

$junk = Get-ChildItem -Force | Where-Object {
  $_.Name -notin $allowed -and $_.Length -eq 0
}

Write-Host "Found $($junk.Count) suspicious zero-byte root files"
$junk | ForEach-Object { Write-Host " - $($_.Name)" }

if ($junk.Count -gt 0) {
  $junk | Remove-Item -Force
  Write-Host "Deleted suspicious zero-byte root files."
} else {
  Write-Host "No suspicious zero-byte root files found."
}

$targets = @(".next", ".turbo")
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item $t -Recurse -Force
    Write-Host "Removed $t"
  }
}

Write-Host "Done. Now run: npm run dev"
