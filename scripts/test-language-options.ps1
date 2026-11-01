param(
    [string]$BaseUrl = 'http://127.0.0.1:3000',
    [string]$DisabledCode = ''
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message" -ForegroundColor Green
}

Write-Host "Checking $base (read-only; no plugin changes)"
$enabled = @(Invoke-RestMethod -Uri "$base/languages" -Method Get)
$options = @(Invoke-RestMethod -Uri "$base/languages/available-options" -Method Get)

Assert-True ($options.Count -gt 0) 'Language options endpoint returns data'
Assert-True (@($options | Where-Object { $_.code -eq 'en' -and $_.enabled -eq $true }).Count -eq 1) 'English is enabled'
Assert-True (@($options | Group-Object code | Where-Object { $_.Count -gt 1 }).Count -eq 0) 'Language codes are unique'

foreach ($item in $options) {
    Assert-True (-not [string]::IsNullOrWhiteSpace($item.code)) "Option has a code: $($item.name)"
    Assert-True ($item.enabled -is [bool]) "Option has boolean enabled: $($item.code)"
}

$enabledCodes = @($enabled | ForEach-Object { $_.code } | Sort-Object)
$optionEnabledCodes = @($options | Where-Object { $_.enabled } | ForEach-Object { $_.code } | Sort-Object)
Assert-True (($enabledCodes -join ',') -eq ($optionEnabledCodes -join ',')) 'Enabled language lists match'

$disabled = @($options | Where-Object { -not $_.enabled })
Write-Host "Disabled options visible: $($disabled.Count)"
if ($disabled.Count -gt 0) {
    Write-Host "Disabled language codes: $($disabled.code -join ', ')"
}

if ($DisabledCode) {
    Assert-True (@($disabled | Where-Object { $_.code -eq $DisabledCode }).Count -eq 1) "$DisabledCode is visible but disabled"
    $uri = "$base/languages/$([uri]::EscapeDataString($DisabledCode))/translations"
    $status = $null
    try {
        $response = Invoke-WebRequest -Uri $uri -Method Get -ErrorAction Stop
        $status = [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-True ($status -eq 404) "Disabled language translations return HTTP 404 (received $status)"
}

Write-Host 'Read-only API checks complete.' -ForegroundColor Green
