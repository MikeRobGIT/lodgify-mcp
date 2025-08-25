# MCPO Startup Script for Lodgify MCP Server (PowerShell)
# Handles local development and production MCPO proxy startup on Windows

param(
    [string]$Port = "8000",
    [string]$Config = "mcpo.config.json",
    [string]$ApiKey = $env:MCPO_API_KEY,
    [string]$Environment = "",
    [switch]$Debug,
    [switch]$Foreground,
    [string]$Command = "start"
)

# Color functions
function Write-Info { param($Message) Write-Host "[mcpo-start] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[mcpo-start] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[mcpo-start WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[mcpo-start ERROR] $Message" -ForegroundColor Red }

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Default values
if (-not $ApiKey) { $ApiKey = "mcpo-default-key" }

function Show-Usage {
    @"
Usage: .\start-mcpo.ps1 [OPTIONS] [COMMAND]

MCPO startup script for Lodgify MCP Server (Windows)

OPTIONS:
    -Port PORT              Set MCPO port (default: 8000)
    -Config CONFIG          Set config file path (default: mcpo.config.json)
    -ApiKey KEY             Set API key for MCPO
    -Environment ENV        Set environment (dev, prod)
    -Debug                  Enable debug mode
    -Foreground             Run in foreground

COMMANDS:
    start                   Start MCPO proxy (default)
    stop                    Stop running MCPO proxy
    restart                 Restart MCPO proxy
    status                  Check MCPO proxy status
    test                    Test MCPO endpoints

EXAMPLES:
    .\start-mcpo.ps1                        Start MCPO with defaults
    .\start-mcpo.ps1 -Port 9000 -Debug     Start on port 9000 with debug
    .\start-mcpo.ps1 stop                   Stop running MCPO

ENVIRONMENT VARIABLES:
    LODGIFY_API_KEY         Required: Lodgify API key
    MCPO_PORT               MCPO proxy port
    MCPO_API_KEY            MCPO API key
"@
}

function Test-McpoInstalled {
    try {
        $null = Get-Command mcpo -ErrorAction Stop
        return $true
    }
    catch {
        Write-Error "MCPO is not installed. Please install it first:"
        Write-Error "  pip install mcpo"
        return $false
    }
}

function Test-Environment {
    Write-Info "Validating environment..."
    
    if (-not $env:LODGIFY_API_KEY -or $env:LODGIFY_API_KEY -eq "your_lodgify_api_key_here") {
        Write-Error "LODGIFY_API_KEY is not set or contains default value"
        Write-Error "Please set LODGIFY_API_KEY environment variable"
        return $false
    }
    
    $ConfigPath = Join-Path $ProjectRoot $Config
    if (-not (Test-Path $ConfigPath)) {
        Write-Error "Configuration file not found: $ConfigPath"
        Write-Error "Available config files:"
        Get-ChildItem "$ProjectRoot\mcpo*.json" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $($_.Name)" }
        return $false
    }
    
    Write-Success "Environment validation passed"
    return $true
}

function New-ConfigWithSubstitution {
    param($ConfigPath)
    
    Write-Info "Preparing configuration file..."
    
    $TempConfig = Join-Path $env:TEMP "mcpo-config-$(Get-Random).json"
    $Content = Get-Content $ConfigPath -Raw
    $Content = $Content -replace "your_lodgify_api_key_here", $env:LODGIFY_API_KEY
    $Content | Set-Content $TempConfig
    
    # Test JSON validity
    try {
        $null = $Content | ConvertFrom-Json
        return $TempConfig
    }
    catch {
        Write-Error "Invalid JSON in configuration file: $ConfigPath"
        Remove-Item $TempConfig -ErrorAction SilentlyContinue
        return $null
    }
}

function Start-Mcpo {
    Write-Info "Starting MCPO proxy..."
    
    $ConfigPath = Join-Path $ProjectRoot $Config
    $TempConfig = New-ConfigWithSubstitution -ConfigPath $ConfigPath
    
    if (-not $TempConfig) {
        return $false
    }
    
    # Log configuration
    Write-Info "Configuration:"
    Write-Info "  Port: $Port"
    Write-Info "  Config: $Config"
    Write-Info "  API Key: [REDACTED]"
    Write-Info "  Environment: $Environment"
    
    # Build command
    $McpoArgs = @(
        "--port", $Port,
        "--api-key", $ApiKey,
        "--config", $TempConfig
    )
    
    if ($Debug) { $McpoArgs += "--debug" }
    if ($Environment -eq "development") { $McpoArgs += "--hot-reload" }
    
    Write-Success "Starting MCPO with arguments: $($McpoArgs -join ' ')"
    
    # Create logs directory
    $LogsDir = Join-Path $ProjectRoot "logs"
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir | Out-Null
    }
    
    if (-not $Foreground) {
        # Background mode
        $Process = Start-Process mcpo -ArgumentList $McpoArgs -PassThru -WindowStyle Hidden
        $Process.Id | Set-Content (Join-Path $LogsDir "mcpo.pid")
        Write-Success "MCPO started in background (PID: $($Process.Id))"
        Write-Success "OpenAPI docs: http://localhost:$Port/docs"
        
        # Schedule cleanup
        Start-Job -ScriptBlock { 
            param($TempFile)
            Start-Sleep 10
            Remove-Item $TempFile -ErrorAction SilentlyContinue
        } -ArgumentList $TempConfig | Out-Null
    }
    else {
        # Foreground mode
        Write-Success "Starting MCPO in foreground. Press Ctrl+C to stop."
        Write-Success "OpenAPI docs: http://localhost:$Port/docs"
        
        try {
            & mcpo @McpoArgs
        }
        finally {
            Remove-Item $TempConfig -ErrorAction SilentlyContinue
        }
    }
    
    return $true
}

function Stop-Mcpo {
    Write-Info "Stopping MCPO proxy..."
    
    $PidFile = Join-Path $ProjectRoot "logs\mcpo.pid"
    
    if (Test-Path $PidFile) {
        $Pid = Get-Content $PidFile
        try {
            $Process = Get-Process -Id $Pid -ErrorAction Stop
            $Process.Kill()
            $Process.WaitForExit(5000)
            Remove-Item $PidFile
            Write-Success "MCPO stopped"
        }
        catch {
            Write-Warning "Could not stop MCPO process (PID: $Pid)"
            Remove-Item $PidFile -ErrorAction SilentlyContinue
        }
    }
    else {
        # Try to find MCPO processes
        $McpoProcesses = Get-Process | Where-Object { $_.ProcessName -like "*mcpo*" -or $_.CommandLine -like "*mcpo*" }
        if ($McpoProcesses) {
            Write-Warning "Found MCPO processes, attempting to stop..."
            $McpoProcesses | Stop-Process -Force
            Write-Success "MCPO processes stopped"
        }
        else {
            Write-Info "No MCPO processes found"
        }
    }
}

function Test-McpoStatus {
    Write-Info "Checking MCPO status..."
    
    $PidFile = Join-Path $ProjectRoot "logs\mcpo.pid"
    
    if (Test-Path $PidFile) {
        $Pid = Get-Content $PidFile
        try {
            $Process = Get-Process -Id $Pid -ErrorAction Stop
            Write-Success "MCPO is running (PID: $Pid)"
            Write-Success "REST API: http://localhost:$Port"
            Write-Success "OpenAPI docs: http://localhost:$Port/docs"
            
            # Test API
            try {
                $Response = Invoke-WebRequest "http://localhost:$Port/docs" -UseBasicParsing -TimeoutSec 5
                if ($Response.StatusCode -eq 200) {
                    Write-Success "API is responding"
                }
            }
            catch {
                Write-Warning "API is not responding"
            }
            return $true
        }
        catch {
            Write-Warning "MCPO PID file exists but process not running"
            Remove-Item $PidFile -ErrorAction SilentlyContinue
            return $false
        }
    }
    else {
        Write-Info "MCPO is not running"
        return $false
    }
}

function Test-McpoEndpoints {
    Write-Info "Testing MCPO endpoints..."
    
    $BaseUrl = "http://localhost:$Port"
    
    # Test health endpoint
    Write-Info "Testing health endpoint..."
    try {
        Invoke-WebRequest "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Success "✓ Health endpoint responding"
    }
    catch {
        Write-Error "✗ Health endpoint not responding"
    }
    
    # Test docs endpoint
    Write-Info "Testing docs endpoint..."
    try {
        Invoke-WebRequest "$BaseUrl/docs" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Success "✓ OpenAPI docs available"
    }
    catch {
        Write-Warning "✗ OpenAPI docs not available"
    }
    
    # Test OpenAPI spec
    Write-Info "Testing OpenAPI spec..."
    try {
        Invoke-WebRequest "$BaseUrl/openapi.json" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Success "✓ OpenAPI specification available"
    }
    catch {
        Write-Warning "✗ OpenAPI specification not available"
    }
    
    Write-Info "Test complete. Visit $BaseUrl/docs for interactive documentation"
}

# Main execution
Push-Location $ProjectRoot

try {
    # Auto-detect environment
    if (-not $Environment) {
        if (Test-Path "mcpo.dev.json") {
            $Environment = "development"
        }
        else {
            $Environment = "production"
        }
    }
    
    # Load .env file if exists
    $EnvFile = Join-Path $ProjectRoot ".env"
    if (Test-Path $EnvFile) {
        Write-Info "Loading environment from .env"
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
            }
        }
    }
    
    # Execute command
    switch ($Command.ToLower()) {
        "start" {
            if (-not (Test-McpoInstalled)) { exit 1 }
            if (-not (Test-Environment)) { exit 1 }
            if (-not (Start-Mcpo)) { exit 1 }
        }
        "stop" {
            Stop-Mcpo
        }
        "restart" {
            Stop-Mcpo
            Start-Sleep 2
            if (-not (Test-McpoInstalled)) { exit 1 }
            if (-not (Test-Environment)) { exit 1 }
            if (-not (Start-Mcpo)) { exit 1 }
        }
        "status" {
            Test-McpoStatus | Out-Null
        }
        "test" {
            Test-McpoEndpoints
        }
        default {
            Write-Error "Unknown command: $Command"
            Show-Usage
            exit 1
        }
    }
}
finally {
    Pop-Location
}