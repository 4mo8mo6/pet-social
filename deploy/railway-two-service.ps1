param(
  [string]$ProjectName = "pet-agent-social",
  [string]$Workspace,
  [string]$AppService = "app",
  [string]$DatabaseService = "Postgres",
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-RailwayResult {
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments
  )

  $output = & railway @Arguments 2>&1

  return [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output   = @($output)
  }
}

function Invoke-Railway {
  param(
    [Parameter(Mandatory)]
    [string[]]$Arguments
  )

  $result = Invoke-RailwayResult -Arguments $Arguments
  if ($result.ExitCode -ne 0) {
    throw (($result.Output | ForEach-Object { "$_" }) -join [Environment]::NewLine)
  }

  return $result.Output
}

function Read-DotEnv {
  param(
    [Parameter(Mandatory)]
    [string]$Path
  )

  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      $value.Length -ge 2 -and (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Get-Setting {
  param(
    [hashtable]$ApiEnv,
    [hashtable]$WebEnv,
    [string]$Name,
    [string]$DefaultValue = ""
  )

  $envValue = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($envValue)) {
    return $envValue
  }

  if ($ApiEnv.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($ApiEnv[$Name])) {
    return $ApiEnv[$Name]
  }

  if ($WebEnv.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($WebEnv[$Name])) {
    return $WebEnv[$Name]
  }

  return $DefaultValue
}

function Require-Setting {
  param(
    [hashtable]$ApiEnv,
    [hashtable]$WebEnv,
    [string]$Name,
    [string]$DefaultValue = ""
  )

  $value = Get-Setting -ApiEnv $ApiEnv -WebEnv $WebEnv -Name $Name -DefaultValue $DefaultValue
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required setting: $Name"
  }

  return $value
}

function Test-LinkedProject {
  $result = Invoke-RailwayResult -Arguments @("status", "--json")
  return $result.ExitCode -eq 0
}

function Ensure-LinkedProject {
  param(
    [string]$ProjectName,
    [string]$Workspace
  )

  if (Test-LinkedProject) {
    Write-Host "Railway project is already linked for this directory."
    return
  }

  $arguments = @("init", "-n", $ProjectName, "--json")
  if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
    $arguments += @("-w", $Workspace)
  }

  Write-Host "Creating and linking Railway project '$ProjectName'..."
  $projectJson = (Invoke-Railway -Arguments $arguments) -join ""
  $project = $projectJson | ConvertFrom-Json
  Invoke-Railway -Arguments @("link", "-p", $project.id) | Out-Null
}

function Ensure-ServiceExists {
  param(
    [string[]]$Arguments,
    [string]$DisplayName
  )

  $result = Invoke-RailwayResult -Arguments $Arguments
  if ($result.ExitCode -eq 0) {
    Write-Host "$DisplayName ready."
    return
  }

  $message = ($result.Output | ForEach-Object { "$_" }) -join [Environment]::NewLine
  if ($message -match "already exists" -or $message -match "duplicate" -or $message -match "exists") {
    Write-Host "$DisplayName already exists, continuing."
    return
  }

  throw $message
}

function Set-PlainVariables {
  param(
    [string]$Service,
    [string[]]$Variables
  )

  if ($Variables.Count -eq 0) {
    return
  }

  $arguments = @("variable", "set", "-s", $Service, "--skip-deploys") + $Variables
  Invoke-Railway -Arguments $arguments | Out-Null
}

function Set-SecretVariable {
  param(
    [string]$Service,
    [string]$Key,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Secret value for $Key is empty."
  }

  $Value | railway variable set -s $Service --skip-deploys $Key --stdin | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed setting secret variable: $Key"
  }
}

function Get-ServiceVariableValue {
  param(
    [string[]]$CandidateServices,
    [string]$Key
  )

  foreach ($service in $CandidateServices) {
    if ([string]::IsNullOrWhiteSpace($service)) {
      continue
    }

    $result = Invoke-RailwayResult -Arguments @("variable", "list", "-s", $service, "-k")
    if ($result.ExitCode -ne 0) {
      continue
    }

    $line = $result.Output | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
    if ($null -ne $line) {
      return ($line -split "=", 2)[1]
    }
  }

  throw "Unable to resolve $Key from Railway service(s): $($CandidateServices -join ', ')"
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory

Push-Location -LiteralPath $repoRoot
try {
  Invoke-Railway -Arguments @("--version") | Out-Null

  $loginState = Invoke-RailwayResult -Arguments @("whoami")
  if ($loginState.ExitCode -ne 0) {
    throw "Railway CLI is not logged in. Run 'railway login' first, then rerun this script."
  }

  $apiEnv = Read-DotEnv -Path "api/.env"
  $webEnv = Read-DotEnv -Path "web/.env.local"

  $secondMeClientId = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "SECONDME_CLIENT_ID"
  $secondMeClientSecret = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "SECONDME_CLIENT_SECRET"
  $llmApiKey = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "LLM_API_KEY"
  $llmBaseUrl = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "LLM_BASE_URL" -DefaultValue "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1"
  $llmModel = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "LLM_MODEL" -DefaultValue "qwen-flash"
  $secondMeOauthUrl = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "SECONDME_OAUTH_URL" -DefaultValue "https://go.second.me/oauth/"
  $secondMeTokenEndpoint = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "SECONDME_TOKEN_ENDPOINT" -DefaultValue "https://api.mindverse.com/gate/lab/api/oauth/token/code"
  $secondMeRefreshEndpoint = Require-Setting -ApiEnv $apiEnv -WebEnv $webEnv -Name "SECONDME_REFRESH_ENDPOINT" -DefaultValue "https://api.mindverse.com/gate/lab/api/oauth/token/refresh"

  Ensure-LinkedProject -ProjectName $ProjectName -Workspace $Workspace

  Ensure-ServiceExists -Arguments @("add", "--database", "postgres", "-s", $DatabaseService, "--json") -DisplayName "Postgres service '$DatabaseService'"
  Ensure-ServiceExists -Arguments @("add", "--service", $AppService, "--json") -DisplayName "App service '$AppService'"

  $databaseUrl = Get-ServiceVariableValue -CandidateServices @(
    $DatabaseService,
    "Postgres",
    "postgres"
  ) -Key "DATABASE_URL"

  Set-PlainVariables -Service $AppService -Variables @(
    "APP_ENV=production",
    'CORS_ALLOWED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}',
    'NEXT_PUBLIC_APP_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}',
    'NEXT_PUBLIC_API_BASE_URL=/api/backend',
    'API_BASE_URL=http://127.0.0.1:8000',
    "SECONDME_OAUTH_URL=$secondMeOauthUrl",
    "SECONDME_TOKEN_ENDPOINT=$secondMeTokenEndpoint",
    "SECONDME_REFRESH_ENDPOINT=$secondMeRefreshEndpoint",
    'SECONDME_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/secondme/callback',
    "LLM_BASE_URL=$llmBaseUrl",
    "LLM_MODEL=$llmModel"
  )

  Set-SecretVariable -Service $AppService -Key "SECONDME_CLIENT_ID" -Value $secondMeClientId
  Set-SecretVariable -Service $AppService -Key "SECONDME_CLIENT_SECRET" -Value $secondMeClientSecret
  Set-SecretVariable -Service $AppService -Key "LLM_API_KEY" -Value $llmApiKey
  Set-SecretVariable -Service $AppService -Key "DATABASE_URL" -Value $databaseUrl

  $domainResult = Invoke-RailwayResult -Arguments @("domain", "-s", $AppService, "-p", "3000", "--json")
  if ($domainResult.ExitCode -eq 0) {
    Write-Host "Railway domain generated for '$AppService'."
  } else {
    $domainMessage = ($domainResult.Output | ForEach-Object { "$_" }) -join [Environment]::NewLine
    if ($domainMessage -match "already" -or $domainMessage -match "maximum of 1 railway provided domain") {
      Write-Host "Railway domain already exists for '$AppService', continuing."
    } else {
      throw $domainMessage
    }
  }

  if (-not $SkipDeploy) {
    Write-Host "Deploying local workspace to Railway service '$AppService'..."
    Invoke-Railway -Arguments @("up", "-s", $AppService, "-d", "-m", "Automated local deploy from Codex") | Out-Null
  }

  Write-Host ""
  Write-Host "Deployment flow finished."
  Write-Host "Dashboard:"
  Invoke-Railway -Arguments @("open", "-p")
  Write-Host ""
  Write-Host "Recommended checks:"
  Write-Host "  1. Open the dashboard and wait for the app deployment to become healthy."
  Write-Host "  2. Verify /api/deploy-health returns status ok."
  Write-Host "  3. Update SecondMe callback to https://<app-domain>/api/auth/secondme/callback"
}
finally {
  Pop-Location
}
