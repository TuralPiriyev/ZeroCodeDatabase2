Param(
  [Parameter(Mandatory=$true,Position=0)] [string]$Url,
  [Parameter(Mandatory=$false,Position=1)] [string]$Token,
  [Parameter(Mandatory=$false,Position=2)] [string]$OutDir = "./diag-out"
)

If (-Not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$HeadersFile = Join-Path $OutDir 'headers.txt'
$BodyFile = Join-Path $OutDir 'body.json'

$Headers = @{ 'Content-Type' = 'application/json' }
If ($Token) { $Headers['Authorization'] = "Bearer $Token" }

Try {
  $resp = Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -Body (ConvertTo-Json @{ inputs = 'test' }) -ErrorAction Stop -SkipHttpErrorCheck:$true
  # Note: Invoke-RestMethod throws on non-2xx; fallback handled below
} Catch {
  # Save raw response if available
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    Set-Content -Path $BodyFile -Value $body
    $_.Exception.Response.Headers | Out-File -FilePath $HeadersFile
  }
}

If (-Not (Test-Path $BodyFile)) {
  # Try a direct WebRequest to capture headers/status
  $wc = New-Object System.Net.WebClient
  foreach ($k in $Headers.Keys) { $wc.Headers.Add($k, $Headers[$k]) }
  try { $out = $wc.UploadString($Url, 'POST', '{"inputs":"test"}') ; Set-Content -Path $BodyFile -Value $out } catch { $err = $_ }
}

Write-Host "Saved headers: $HeadersFile" -ForegroundColor Cyan
Write-Host "Saved body: $BodyFile" -ForegroundColor Cyan

If (Test-Path $HeadersFile) { Get-Content $HeadersFile | Select-String -Pattern 'Retry-After|x-request-id|x-rate-limit' -SimpleMatch -CaseSensitive:$false }

If (Test-Path $BodyFile) { Get-Content $BodyFile -TotalCount 200 }

Write-Host "Diag complete"
