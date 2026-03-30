// PCLabs — main.js
// ─────────────────────────────────────────────────────────────────────────────
// Architecture:
//   Legacy collectors  (collect*)  – original broad PowerShell collectors,
//                                    kept for backward-compatibility while the
//                                    new module layer is proven in production.
//   Dedicated modules  (scan*)     – structured single-purpose modules that
//                                    return typed objects.  buildCategories()
//                                    prefers these when present, falls back to
//                                    legacy collector data otherwise.
//
//   isInfo=true   → hardware fact; never penalises score, never surfaces in
//                   Top Issues or Recommendations.
//   capSev()      → downgrades severity when confidence is low.
//   summarise()   → confidence-weighted scoring; floor 30, ceiling 96/100.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

// ── License keys (loaded from keys.json — never committed to git) ─────────────
const BETA_KEYS = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'keys.json'), 'utf8'))
);
const { exec } = require('child_process');

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1020, height: 700, minWidth: 840, minHeight: 580,
    frame: false,
    backgroundColor: '#080b10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
  ipcMain.on('win-min',       () => win.minimize());
  ipcMain.on('win-max',       () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('win-close',     () => win.close());
  ipcMain.on('open-feedback', () =>
    shell.openExternal('mailto:hello@thepclabs.com?subject=PCLabs%20Feedback')
  );
  ipcMain.on('open-external', (_, url) => {
    const allowed = /^https:\/\/thepclabs\.com\//;
    if (allowed.test(url)) shell.openExternal(url);
  });
  ipcMain.handle('validate-key', (_, key) => BETA_KEYS.has(String(key).trim().toUpperCase()));
}

// ── Shell helpers ─────────────────────────────────────────────────────────────

function pse(script, timeout = 12000) {
  return new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
      { timeout },
      (err, stdout) => resolve((stdout || '').trim() || null)
    );
  });
}
function tryJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── pseFile: temp-file executor ─────────────────────────────────────────────
// Writes script to a temp .ps1 file and runs it with -ExecutionPolicy Bypass.
// Required for collectors whose PS scripts exceed the cmd.exe -Command length
// limit (~8191 chars) or contain complex syntax cmd.exe mishandles.
let _pf_seq = 0;
function pseFile(name, script, timeout = 18000) {
  const tmpFile = path.join(os.tmpdir(), `pclabs_${name}_${++_pf_seq}.ps1`);
  try { fs.writeFileSync(tmpFile, script, 'utf8'); } catch(e) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout },
      (err, stdout) => {
        try { fs.unlinkSync(tmpFile); } catch(_) {}
        resolve((stdout || '').trim() || null);
      }
    );
  });
}
// ── end pseFile ───────────────────────────────────────────────────────────────

// ── Hardware detectors ────────────────────────────────────────────────────────

async function detectCpu() {
  const r = tryJson(await pse('Get-CimInstance Win32_Processor | Select-Object -First 1 Name | ConvertTo-Json -Compress'));
  return (r?.Name || 'Unknown CPU').trim();
}
async function detectGpu() {
  const r = tryJson(await pse(
    'Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Sort-Object AdapterRAM -Descending | Select-Object -First 1 Name | ConvertTo-Json -Compress'
  ));
  return (r?.Name || 'Unknown GPU').trim();
}
async function detectOs() {
  const r = tryJson(await pse('Get-CimInstance Win32_OperatingSystem | Select-Object Caption,BuildNumber | ConvertTo-Json -Compress'));
  if (!r) return 'Windows';
  const cap = (r.Caption || 'Windows').replace('Microsoft ', '').trim();
  return r.BuildNumber ? `${cap} (Build ${r.BuildNumber})` : cap;
}
async function detectDisk() {
  const r = tryJson(await pse('Get-Volume -DriveLetter C | Select-Object Size,SizeRemaining | ConvertTo-Json -Compress'));
  if (r) {
    const total = Number(r.Size), rem = Number(r.SizeRemaining);
    if (total > 0 && rem >= 0 && rem <= total)
      return { diskTotal: Math.round(total/(1024**3)), diskFree: Math.round(rem/(1024**3)), diskUsedPct: Math.round(((total-rem)/total)*100) };
  }
  return { diskTotal: null, diskFree: null, diskUsedPct: null };
}

// ── Legacy collectors (kept until module layer is fully adopted) ──────────────

async function collectSystemProfile() {
  const obj = tryJson(await pse(`
$mobo=$( Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product )
$bios=$( Get-CimInstance Win32_BIOS | Select-Object SMBIOSBIOSVersion,ReleaseDate )
$chassis=(Get-CimInstance Win32_SystemEnclosure).ChassisTypes
$bat=$( Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining )
$vid=$( Get-CimInstance Win32_VideoController | Select-Object -First 1 CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate )
@{Mobo=$mobo;Bios=$bios;Chassis=$chassis;Battery=$bat;Monitor=$vid}|ConvertTo-Json -Compress -Depth 5`));
  if (!obj) return {};
  const laptopTypes = [8,9,10,11,14,30,31,32];
  const ch = obj.Chassis;
  const isLaptop = Array.isArray(ch) ? ch.some(c=>laptopTypes.includes(Number(c))) : laptopTypes.includes(Number(ch));
  let biosYear = null;
  try { const d=new Date(obj.Bios?.ReleaseDate); if(!isNaN(d)) biosYear=d.getFullYear(); } catch(_){}
  return {
    moboMfr:    obj.Mobo?.Manufacturer            || null,
    moboModel:  obj.Mobo?.Product                 || null,
    biosVersion:obj.Bios?.SMBIOSBIOSVersion        || null,
    biosYear, isLaptop,
    batteryPct: obj.Battery?.EstimatedChargeRemaining ?? null,
    monitorW:   obj.Monitor?.CurrentHorizontalResolution || null,
    monitorH:   obj.Monitor?.CurrentVerticalResolution   || null,
    monitorHz:  obj.Monitor?.CurrentRefreshRate          || null,
  };
}

async function collectStorage() {
  let disks = tryJson(await pse('Get-PhysicalDisk | Select-Object MediaType,Size,HealthStatus,OperationalStatus | ConvertTo-Json -Compress'));
  if (disks && !Array.isArray(disks)) disks = [disks];
  return { disks: disks || [] };
}

async function collectStability() {
  const r = tryJson(await pse(`
$bsod=@(Get-WinEvent -FilterHashtable @{LogName='System';Id=1001;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$kp=@(Get-WinEvent -FilterHashtable @{LogName='System';Id=41;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$ac=@(Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 50 -ErrorAction SilentlyContinue)
$whea=@(Get-WinEvent -FilterHashtable @{LogName='System';Id=18;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
@{BsodCount=$bsod.Count;KernelPowerCount=$kp.Count;AppCrashCount=$ac.Count;WheaCount=$whea.Count;
  LatestBsod=if($bsod.Count-gt 0){$bsod[0].TimeCreated.ToString('yyyy-MM-dd')}else{$null}}|ConvertTo-Json -Compress`));
  return r || {};
}

// ── scanStability ─────────────────────────────────────────────────────────────
// Dedicated module: structured crash and reliability data.
// Returns a typed object with richer signal than the legacy count-only collector.
// buildCategories() prefers this when present.
//
// Returns:
//   bsod:     { count, recent: [{date, code, codeName}], latestDate }
//   kp:       { count, recent: [{date, likelyCause}] }
//   appCrash: { count7d, topCrashers: [{name, count}] }
//   whea:     { count, sources: [string] }
//   svcFail:  { count, services: [string] }
//   reliabilityIndex: number | null   (1.0–10.0, Windows computed)

async function scanStability() {
  const raw = tryJson(await pse(`
# ── BSODs (last 30 days, Id=1001 = Windows Error Reporting bugcheck) ──────────
$bsodEvts = @(Get-WinEvent -FilterHashtable @{LogName='System';Id=1001;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$bsodList = @(foreach ($e in $bsodEvts) {
    $code = $null
    try {
        $xml  = [xml]$e.ToXml()
        $data = $xml.Event.EventData.Data
        # BugcheckCode is typically the first Data element
        $raw  = ($data | Where-Object { $_.Name -eq 'BugcheckCode' } | Select-Object -First 1).'#text'
        if (-not $raw) { $raw = @($data)[0].'#text' }
        if ($raw -match '^\d+$') { $code = '0x{0:X8}' -f [int]$raw }
        elseif ($raw -match '^0x') { $code = $raw.Trim() }
    } catch {}
    [PSCustomObject]@{
        Date = $e.TimeCreated.ToString('yyyy-MM-dd')
        Code = $code
    }
})

# ── Kernel-power Id=41 (unexpected shutdown, last 30 days) ────────────────────
$kpEvts = @(Get-WinEvent -FilterHashtable @{LogName='System';Id=41;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$kpList = @(foreach ($e in $kpEvts) {
    $cause = 'Unknown'
    try {
        $xml = [xml]$e.ToXml()
        $data = $xml.Event.EventData.Data
        $bugcheck = ($data | Where-Object { $_.Name -eq 'BugcheckCode' } | Select-Object -First 1).'#text'
        if ($bugcheck -and $bugcheck -ne '0') { $cause = 'Likely crash/BSOD related' }
        else { $cause = 'Power loss or forced shutdown' }
    } catch {}
    [PSCustomObject]@{ Date = $e.TimeCreated.ToString('yyyy-MM-dd'); LikelyCause = $cause }
})

# ── App crashes Id=1000 (last 7 days), grouped by executable ─────────────────
$acEvts = @(Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 100 -ErrorAction SilentlyContinue)
$topCrashers = @($acEvts | ForEach-Object {
    $name = $null
    try {
        $xml = [xml]$_.ToXml()
        $data = $xml.Event.EventData.Data
        $name = ($data | Where-Object { $_.Name -eq 'param1' } | Select-Object -First 1).'#text'
        if (-not $name) { $name = @($data)[0].'#text' }
    } catch {}
    $name
} | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 5 |
    Select-Object @{n='Name';e={$_.Name}}, @{n='Count';e={$_.Count}})

# ── WHEA hardware errors Id=18 (last 30 days) ─────────────────────────────────
$wheaEvts = @(Get-WinEvent -FilterHashtable @{LogName='System';Id=18;StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$wheaSources = @($wheaEvts | ForEach-Object {
    $src = $null
    try {
        $xml = [xml]$_.ToXml()
        $data = $xml.Event.EventData.Data
        $src = ($data | Where-Object { $_.Name -eq 'ErrorSource' -or $_.Name -eq 'ErrorSeverity' } | Select-Object -First 1).'#text'
    } catch {}
    if ($src) { $src } else { 'Hardware' }
} | Sort-Object -Unique | Select-Object -First 5)

# ── Service failures Id=7034 (unexpected stop) + 7031 (terminated) last 7d ────
$svcEvts = @(Get-WinEvent -FilterHashtable @{LogName='System';Id=7034;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 10 -ErrorAction SilentlyContinue) +
           @(Get-WinEvent -FilterHashtable @{LogName='System';Id=7031;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 10 -ErrorAction SilentlyContinue)
$svcNames = @($svcEvts | ForEach-Object {
    try {
        $xml = [xml]$_.ToXml()
        ($xml.Event.EventData.Data | Select-Object -First 1).'#text'
    } catch { $null }
} | Where-Object { $_ } | Sort-Object -Unique | Select-Object -First 5)

# ── Windows Reliability Index (most recent score from WMI) ────────────────────
$ri = $null
try {
    $riObj = Get-CimInstance -ClassName Win32_ReliabilityStabilityMetrics -ErrorAction Stop |
        Sort-Object TimeGenerated -Descending | Select-Object -First 1
    if ($riObj) { $ri = [math]::Round($riObj.SystemStabilityIndex, 1) }
} catch {}

@{
    BsodList       = $bsodList
    BsodCount      = $bsodEvts.Count
    KpList         = $kpList
    KpCount        = $kpEvts.Count
    AppCrashCount  = $acEvts.Count
    TopCrashers    = $topCrashers
    WheaCount      = $wheaEvts.Count
    WheaSources    = $wheaSources
    SvcFailCount   = $svcEvts.Count
    SvcNames       = $svcNames
    ReliabilityIndex = $ri
} | ConvertTo-Json -Compress -Depth 4`, 18000));

  if (!raw) return {
    bsod:     { count: 0, recent: [], latestDate: null },
    kp:       { count: 0, recent: [] },
    appCrash: { count7d: 0, topCrashers: [] },
    whea:     { count: 0, sources: [] },
    svcFail:  { count: 0, services: [] },
    reliabilityIndex: null,
  };

  // Normalise bsod list — deduplicate stop codes for display
  const bsodList = Array.isArray(raw.BsodList) ? raw.BsodList : [];
  const bsodRecent = bsodList.slice(0, 5).map(e => ({
    date: e.Date || null,
    code: e.Code || null,
  }));

  // Map common stop codes to plain-English names
  const STOP_CODES = {
    '0x0000001E': 'KMODE_EXCEPTION_NOT_HANDLED',
    '0x0000003B': 'SYSTEM_SERVICE_EXCEPTION',
    '0x00000050': 'PAGE_FAULT_IN_NONPAGED_AREA',
    '0x0000007E': 'SYSTEM_THREAD_EXCEPTION_NOT_HANDLED',
    '0x00000109': 'CRITICAL_STRUCTURE_CORRUPTION',
    '0x0000010D': 'WDF_VIOLATION',
    '0x00000116': 'VIDEO_TDR_FAILURE',
    '0x0000011A': 'EM_EXCEPTION_NOT_HANDLED',
    '0x00000124': 'WHEA_UNCORRECTABLE_ERROR',
    '0x0000012B': 'FAULTY_HARDWARE_CORRUPTED_PAGE',
    '0x00000133': 'DPC_WATCHDOG_VIOLATION',
    '0x00000139': 'KERNEL_SECURITY_CHECK_FAILURE',
    '0x0000013A': 'KERNEL_MODE_HEAP_CORRUPTION',
    '0x0000013B': 'PASSIVE_INTERRUPT_ERROR',
    '0x0000013C': 'INVALID_IO_BOOST_STATE',
    '0x00000154': 'UNEXPECTED_STORE_EXCEPTION',
    '0x000000D1': 'DRIVER_IRQL_NOT_LESS_OR_EQUAL',
    '0x000000EF': 'CRITICAL_PROCESS_DIED',
    '0x000000F4': 'CRITICAL_OBJECT_TERMINATION',
    '0xC0000005': 'ACCESS_VIOLATION',
  };
  bsodRecent.forEach(e => {
    if (e.code) {
      const upper = e.code.toUpperCase();
      e.codeName = STOP_CODES[upper] || null;
    }
  });

  const kpList = Array.isArray(raw.KpList) ? raw.KpList : [];
  const topCrashers = Array.isArray(raw.TopCrashers) ? raw.TopCrashers.map(c => ({
    name:  (c.Name  || 'Unknown').trim(),
    count: Number(c.Count || 1),
  })) : [];
  const wheaSources = Array.isArray(raw.WheaSources) ? raw.WheaSources.filter(Boolean) : [];
  const svcNames    = Array.isArray(raw.SvcNames)    ? raw.SvcNames.filter(Boolean)    : [];

  const ri = (raw.ReliabilityIndex !== null && raw.ReliabilityIndex !== undefined)
    ? Number(raw.ReliabilityIndex) : null;

  return {
    bsod:     { count: Number(raw.BsodCount || 0), recent: bsodRecent, latestDate: bsodRecent[0]?.date || null },
    kp:       { count: Number(raw.KpCount   || 0), recent: kpList.slice(0,5).map(e => ({ date: e.Date, likelyCause: e.LikelyCause })) },
    appCrash: { count7d: Number(raw.AppCrashCount || 0), topCrashers },
    whea:     { count: Number(raw.WheaCount || 0), sources: wheaSources },
    svcFail:  { count: Number(raw.SvcFailCount || 0), services: svcNames },
    reliabilityIndex: (ri !== null && !isNaN(ri) && ri >= 1 && ri <= 10) ? ri : null,
  };
}

async function collectPerformance() {
  const r = tryJson(await pse(`
$cpuLoad=[math]::Round((Get-CimInstance Win32_Processor|Measure-Object -Property LoadPercentage -Average).Average,1)
$osObj=Get-CimInstance Win32_OperatingSystem
$ramPct=[math]::Round(($osObj.TotalVisibleMemorySize-$osObj.FreePhysicalMemory)/$osObj.TotalVisibleMemorySize*100,1)
$startupItems=Get-CimInstance Win32_StartupCommand|Select-Object Name,Command
$startup=($startupItems|Measure-Object).Count
$startupNames=@($startupItems|Select-Object -First 20 -ExpandProperty Name)
$plan=try{(Get-CimInstance -Namespace root\cimv2\power -ClassName Win32_PowerPlan|Where-Object{$_.IsActive}|Select-Object -First 1).ElementName}catch{'Unknown'}
$procs=Get-Process|Sort-Object WorkingSet64 -Descending|Select-Object -First 8 Name,@{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB,1)}}
$diskQ=try{[math]::Round((Get-Counter '\PhysicalDisk(_Total)\Current Disk Queue Length' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue,1)}catch{$null}
$gameDVR=try{(Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -ErrorAction SilentlyContinue).AppCaptureEnabled}catch{$null}
$thermal=@(Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';Id=37} -MaxEvents 5 -ErrorAction SilentlyContinue).Count
@{CpuLoad=$cpuLoad;RamUsedPct=$ramPct;StartupCount=$startup;StartupNames=$startupNames;PowerPlan=$plan;TopProcs=$procs;DiskQueueLen=$diskQ;GameDVR=$gameDVR;ThermalCount=$thermal}|ConvertTo-Json -Compress -Depth 5`));
  return r || {};
}

async function collectWindowsHealth() {
  const r = tryJson(await pse(`
$def=try{Get-MpComputerStatus|Select-Object AntivirusEnabled,RealTimeProtectionEnabled}catch{$null}
$sb=try{Confirm-SecureBootUEFI}catch{$null}
$tpm=try{Get-Tpm|Select-Object TpmPresent,TpmEnabled}catch{$null}
$rb=$false
if(Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'){$rb=$true}
if(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations -ErrorAction SilentlyContinue){$rb=$true}
$act=try{$p=Get-CimInstance SoftwareLicensingProduct|Where-Object{$_.Name -like '*Windows*' -and $_.PartialProductKey}|Select-Object -First 1;$p.LicenseStatus -eq 1}catch{$null}
$avc=try{(Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct|Measure-Object).Count}catch{$null}
$bl=try{(Get-BitLockerVolume -MountPoint C: -ErrorAction SilentlyContinue).ProtectionStatus}catch{$null}
@{Defender=$def;SecureBoot=$sb;Tpm=$tpm;PendingReboot=$rb;Activated=$act;AvCount=$avc;BitLocker=$bl}|ConvertTo-Json -Compress -Depth 5`));
  return r || {};
}

async function collectWindowsUpdate() {
  const r = tryJson(await pse(`
try{
  $s=New-Object -ComObject Microsoft.Update.Session
  $result=$s.CreateUpdateSearcher().Search('IsInstalled=0 and IsHidden=0')
  @{PendingCount=$result.Updates.Count}|ConvertTo-Json -Compress
}catch{@{PendingCount=$null}|ConvertTo-Json -Compress}`));
  return r || {};
}

async function collectDrivers() {
  const r = tryJson(await pse(`
$bad=Get-PnpDevice|Where-Object{$_.Status -eq 'Error' -or $_.Status -eq 'Unknown'}|Select-Object FriendlyName,Status,Class
@{ProblematicDevices=@($bad)}|ConvertTo-Json -Compress -Depth 5`));
  return r || {};
}

async function collectNetwork() {
  // All tests use cmd /c system executables to bypass PowerShell process
  // restrictions. .NET Ping and DNS APIs fail in PS constrained contexts.
  const r = tryJson(await pse(`
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object Name,InterfaceDescription,LinkSpeed,PhysicalMediaType
$vpn      = [bool](@(Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'VPN|Tunnel|TAP|WireGuard|OpenVPN' }).Count -gt 0)

# Hostname resolution — positive confirmation required; wildcard matching only
$p1 = (cmd /c "ping -n 2 -w 3000 google.com") -join ' '
$m1 = [bool]($p1 -like '*Reply from*' -or $p1 -like '*TTL=*' -or $p1 -like '*bytes=*' -or $p1 -like '*Request timed out*')

$ns = (cmd /c "nslookup google.com 2>&1") -join ' '
$m2 = [bool]($ns -like '*Address:*' -and -not ($ns -like "can't find") -and -not ($ns -like '*NXDOMAIN*'))

$m3 = [bool](try { $null -ne (Resolve-DnsName google.com -Type A -ErrorAction Stop | Select-Object -First 1).IPAddress } catch { $false })
$m4 = [bool](try { ([System.Net.Dns]::GetHostAddresses('google.com')).Count -gt 0 } catch { $false })

$hostnameResolutionWorked = [bool]($m1 -or $m2 -or $m3 -or $m4)

$ipLines = cmd /c "ping -n 4 -w 2000 8.8.8.8"
$avgLine = @($ipLines | Where-Object { $_ -like '*Average*' }) | Select-Object -Last 1
$lat = $null
if ($avgLine) {
    $parts = $avgLine -split '='
    if ($parts.Count -ge 4) {
        $rawAvg = ($parts[-1].Trim() -replace '[^0-9]','')
        if ($rawAvg.Length -gt 0) { $lat = [int]$rawAvg }
    }
}
$lossLine = @($ipLines | Where-Object { $_ -like '*Lost*' -and $_ -like '*loss*' }) | Select-Object -Last 1
$loss = $null
if ($lossLine -and ($lossLine -match '[(]([0-9]+)[%] loss[)]')) { $loss = [int]$Matches[1] }

@{
  Adapters                 = $adapters
  HasVpn                   = $vpn
  HostnameResolutionWorked = $hostnameResolutionWorked
  Latency                  = $lat
  PacketLoss               = $loss
} | ConvertTo-Json -Compress -Depth 5`));
  return r || {};
}

// ── Dedicated scan modules ────────────────────────────────────────────────────
//
// Each module is a single-purpose async function that:
//  - runs its own PowerShell query
//  - parses and validates the result in JS
//  - returns a typed structured object (never null — always a valid shape)
//  - uses truthful unavailable states rather than invented values
//
// buildCategories() prefers these over the legacy collector data when present.
// ─────────────────────────────────────────────────────────────────────────────

// ── scanBiosMotherboard ───────────────────────────────────────────────────────
// Returns: { bios: {...} | null, motherboard: {...} | null, system: {...} | null }

async function scanBiosMotherboard() {
  // Each CIM query is individually try/catch'd so one WMI failure (common on
  // VMs, Hyper-V guests, locked-down OEM builds) doesn't blank the whole card.
  // ReleaseDate from Win32_BIOS arrives as DMTF format '20210914000000.000000+000'.
  // JS new Date() cannot parse this reliably, so year+date are extracted in PS.
  const _biosScript = `
$out = @{Mobo=$null;Bios=$null;CS=$null}
try { $out.Mobo = Get-CimInstance Win32_BaseBoard -EA Stop | Select-Object Manufacturer,Product,Version } catch {}

# ── BIOS: three-source fallback chain ────────────────────────────────────────
# Source A: CIM (preferred)
$bObj = $null
try { $bObj = Get-CimInstance Win32_BIOS -EA Stop } catch {}

# Source B: WMI — different provider stack, sometimes succeeds where CIM fails
if (-not $bObj -or -not ($bObj.SMBIOSBIOSVersion + '').Trim()) {
    try { $bObj = Get-WmiObject Win32_BIOS -EA Stop } catch {}
}

# Source C: Registry — populated by Windows from DMI data independently of WMI/CIM
$regVer = $null; $regDate = $null; $regMfr = $null
try {
    $rk = Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\BIOS' -EA Stop
    $regVer  = ($rk.BIOSVersion      + '').Trim()
    $regMfr  = ($rk.BIOSVendor       + '').Trim()
    $regDate = ($rk.BIOSReleaseDate  + '').Trim()
} catch {}

# ── Parse date from whichever source has it ──────────────────────────────────
$yr = $null; $dt = $null; $ds = ''
if ($bObj -and $bObj.ReleaseDate) {
    try {
        $ds = [string]$bObj.ReleaseDate
        if ($ds.Length -ge 8 -and $ds -match '^\d') {
            $yr = [int]$ds.Substring(0,4)
            $mo = $ds.Substring(4,2)
            $dy = $ds.Substring(6,2)
            $dt = "$yr-$mo-$dy"
        }
    } catch {}
}
if (-not $dt -and $regDate) {
    try {
        if ($regDate -match '(\d{2})/(\d{2})/(\d{4})') {
            $yr = [int]$Matches[3]; $dt = "$($Matches[3])-$($Matches[1])-$($Matches[2])"
        } elseif ($regDate -match '(\d{4})-(\d{2})-(\d{2})') {
            $yr = [int]$Matches[1]; $dt = $regDate.Substring(0,10)
        }
    } catch {}
}

# ── Pick best version string ──────────────────────────────────────────────────
$verSmbios  = if ($bObj) { ($bObj.SMBIOSBIOSVersion + '').Trim() } else { '' }
$verArr0    = ''
if ($bObj) { $va = @($bObj.BIOSVersion); if ($va.Count -gt 0) { $verArr0 = ($va[0] + '').Trim() } }
$verVersion = if ($bObj) { ($bObj.Version + '').Trim() } else { '' }
$verCaption = if ($bObj) { ($bObj.Caption + '').Trim() } else { '' }
$verReg     = $regVer

$verBest = if     ($verSmbios)  { $verSmbios }
           elseif ($verArr0)    { $verArr0 }
           elseif ($verVersion) { $verVersion }
           elseif ($verReg)     { $verReg }
           else                 { $verCaption }

$mfr = if ($bObj -and ($bObj.Manufacturer + '').Trim()) { ($bObj.Manufacturer + '').Trim() }
       elseif ($regMfr) { $regMfr } else { '' }

$out.Bios = [PSCustomObject]@{Ver=$verBest;Mfr=$mfr;Yr=$yr;Dt=$dt}

try { $out.CS = Get-CimInstance Win32_ComputerSystem -EA Stop | Select-Object Manufacturer,Model,SystemFamily } catch {}
Write-Output ($out | ConvertTo-Json -Compress -Depth 4)`;
  const _biosRaw = await pseFile('BIOS', _biosScript);
  const raw = tryJson(_biosRaw);

  const thisYear = new Date().getFullYear();

  if (!raw) {
    return { bios: null, motherboard: null, system: null };
  }

  // BiosYear parsed in PS from DMTF date — no JS date parsing needed
  const biosYear = (raw.Bios?.Yr && Number.isInteger(raw.Bios.Yr)) ? raw.Bios.Yr : null;

  const result = {
    bios: raw.Bios ? {
      version:      (raw.Bios.Ver || '').trim() || null,
      releaseDate:  raw.Bios.Dt   || null,
      year:         biosYear,
      age:          biosYear !== null ? (thisYear - biosYear) : null,
      manufacturer: (raw.Bios.Mfr || '').trim() || null,
    } : null,
    motherboard: raw.Mobo ? {
      manufacturer: (raw.Mobo.Manufacturer || '').trim() || null,
      model:        (raw.Mobo.Product      || '').trim() || null,
      version:      (raw.Mobo.Version      || '').trim() || null,
    } : null,
    system: raw.CS ? {
      manufacturer: (raw.CS.Manufacturer || '').trim() || null,
      model:        (raw.CS.Model        || '').trim() || null,
      family:       (raw.CS.SystemFamily || '').trim() || null,
    } : null,
  };
  return result;
}

// ── Startup impact reference table ────────────────────────────────────────────
// Conservative estimates based on known startup behaviour.
// impact: 'high' | 'medium' | 'low' | 'unknown'

const STARTUP_IMPACT_MAP = [
  { match: 'teams',          impact: 'high',   reason: 'Loads ~150–300 MB at boot and keeps background sync active' },
  { match: 'slack',          impact: 'high',   reason: 'Electron app — heavy on RAM and network at startup' },
  { match: 'creative cloud', impact: 'high',   reason: 'Runs multiple background services for Adobe apps' },
  { match: 'adobe',          impact: 'medium', reason: 'Adobe updater and background services run continuously' },
  { match: 'discord',        impact: 'medium', reason: 'Overlay and update services run in the background' },
  { match: 'zoom',           impact: 'medium', reason: 'Keeps a background helper process running at all times' },
  { match: 'spotify',        impact: 'medium', reason: 'Loads the audio engine and web helper at startup' },
  { match: 'steam',          impact: 'medium', reason: 'Checks for game updates and loads overlay services' },
  { match: 'epic games',     impact: 'medium', reason: 'Launcher polls for updates in the background' },
  { match: 'onedrive',       impact: 'medium', reason: 'Syncs files in the background from boot' },
  { match: 'dropbox',        impact: 'medium', reason: 'File sync service runs from startup' },
  { match: 'skype',          impact: 'medium', reason: 'Runs background services at startup' },
  { match: 'origin',         impact: 'medium', reason: 'EA launcher background service' },
  { match: 'battle.net',     impact: 'medium', reason: 'Game client background service' },
  { match: 'razer',          impact: 'medium', reason: 'Synapse services use persistent CPU for RGB/macros' },
  { match: 'corsair',        impact: 'medium', reason: 'iCUE runs RGB polling and device services continuously' },
  { match: 'google drive',   impact: 'low',    reason: 'Sync service, generally light on resources' },
  { match: 'icloud',         impact: 'low',    reason: 'Apple sync service for Windows' },
  { match: 'logitech',       impact: 'low',    reason: 'Device driver companion' },
  { match: 'geforce',        impact: 'low',    reason: 'NVIDIA update checker, mostly passive' },
  { match: 'xbox',           impact: 'low',    reason: 'Game Bar and overlay services' },
  { match: 'whatsapp',       impact: 'low',    reason: 'Desktop messaging client' },
  { match: 'telegram',       impact: 'low',    reason: 'Desktop messaging client' },
  { match: 'signal',         impact: 'low',    reason: 'Desktop messaging client' },
];

function classifyStartupImpact(name) {
  const lower = (name || '').toLowerCase();
  for (const entry of STARTUP_IMPACT_MAP) {
    if (lower.includes(entry.match)) return { impact: entry.impact, reason: entry.reason };
  }
  return { impact: 'unknown', reason: null };
}

// ── scanStartupApps ───────────────────────────────────────────────────────────
// Returns:
//   { count, items: [{ name, command, location, publisher, impact, reason }],
//     heavyCount, heavyItems }
//
// Publisher lookup: attempts to read VersionInfo.CompanyName from the exe.
// Limited to first 20 items and uses a longer timeout to avoid blocking the scan.

async function scanStartupApps() {
  // Three startup sources are read and merged to match what Task Manager shows.
  // Win32_StartupCommand alone often misses modern user-level Run key entries.
  // The previous exe-path regex approach was removed: the regex contained literal
  // double-quote chars that pse() escaped to \", silently breaking the match on
  // every call and making the publisher lookup return null for all items.
  // Previous script was ~8103 chars — exceeds cmd.exe -Command limit with wrapper.
  // Write to a temp .ps1 file and execute with powershell -File to bypass the limit.
  const _tmpPs = path.join(os.tmpdir(), 'pclabs_startup.ps1');
  const _psLines = [
    '$seen=@{}',
    '$list=[System.Collections.Generic.List[PSCustomObject]]::new()',
    '@(try{Get-CimInstance Win32_StartupCommand -EA Stop}catch{@()})|ForEach-Object{$k=$_.Name.ToLower().Trim();if($k -and -not $seen[$k]){$seen[$k]=$true;$list.Add([PSCustomObject]@{Name=$_.Name;Cmd=$_.Command;Loc=$_.Location})}}',
    '$p=\"HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\";if(Test-Path $p){(Get-ItemProperty $p -EA SilentlyContinue).PSObject.Properties|Where-Object{$_.Name -notmatch \"^PS\"}|ForEach-Object{$k=$_.Name.ToLower().Trim();if($k -and -not $seen[$k]){$seen[$k]=$true;$list.Add([PSCustomObject]@{Name=$_.Name;Cmd=$_.Value;Loc=\"HKCU\"})}}}',
    '$p=\"HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\";if(Test-Path $p){(Get-ItemProperty $p -EA SilentlyContinue).PSObject.Properties|Where-Object{$_.Name -notmatch \"^PS\"}|ForEach-Object{$k=$_.Name.ToLower().Trim();if($k -and -not $seen[$k]){$seen[$k]=$true;$list.Add([PSCustomObject]@{Name=$_.Name;Cmd=$_.Value;Loc=\"HKLM\"})}}}',
    '@{Items=@($list|Select-Object -First 25);TotalCount=$list.Count}|ConvertTo-Json -Compress -Depth 3',
  ];
  const _startupRaw = await new Promise(resolve => {
    try { fs.writeFileSync(_tmpPs, _psLines.join('\n'), 'utf8'); } catch(_e) { resolve(null); return; }
    exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${_tmpPs}"`, { timeout: 15000 },
      (err, stdout) => {
        resolve((stdout||'').trim() || null);
      });
  });
  try { fs.unlinkSync(_tmpPs); } catch(_e) {}
  const raw = tryJson(_startupRaw);

  if (!raw || !Array.isArray(raw.Items)) {
    return { count: 0, items: [], heavyCount: 0, heavyItems: [] };
  }

  const items = raw.Items
    .filter(item => item && item.Name)
    .map(item => {
      const { impact, reason } = classifyStartupImpact(item.Name);
      return {
        name:      (item.Name || 'Unknown').trim(),
        command:   item.Cmd  || null,
        location:  item.Loc  || null,
        publisher: null,   // publisher lookup removed — was broken by pse() quote escaping
        impact,
        reason,
      };
    });

  const heavyItems = items.filter(i => i.impact === 'high' || i.impact === 'medium');

  const result = {
    count:      typeof raw.TotalCount === 'number' ? raw.TotalCount : items.length,
    items,
    heavyCount: heavyItems.length,
    heavyItems,
  };
  return result;
}

// ── scanBackgroundProcesses ───────────────────────────────────────────────────
// Returns:
//   { totalCount, topMemory, topCpu, duplicates, flagged }
//
// topMemory / topCpu:   [{ name, memMB, cpuSec }]
// duplicates:           [{ name, count, totalMemMB }]  — 3+ instances of same name
// flagged:              [{ name, memMB, reason }]       — known performance drains
//
// Performance-focused only — not malware detection.

// Known user-visible processes that are heavy on resources when running
// in the background, per measured real-world data.
const KNOWN_BG_DRAINS = [
  { match: 'teams',         reason: 'High background RAM and persistent network activity' },
  { match: 'slack',         reason: 'Electron process — high idle RAM use' },
  { match: 'creative cloud',reason: 'Multiple Adobe background services' },
  { match: 'corsair',       reason: 'RGB/device polling uses continuous CPU cycles' },
  { match: 'razer',         reason: 'Synapse services maintain persistent CPU use' },
  { match: 'discord',       reason: 'Overlay and crash-reporter processes run continuously' },
  { match: 'antimalware',   reason: 'Active scan in progress — will settle when complete' },
  { match: 'xboxpcapp',     reason: 'Xbox PC app background services' },
  { match: 'webex',         reason: 'Cisco Webex helper runs in background' },
];

// Processes that belong to Windows itself — the user should not close these
const SYSTEM_PROC_NAMES = new Set([
  'system','idle','memory compression','registry','smss','csrss','wininit',
  'services','lsass','svchost','dwm','winlogon','fontdrvhost','runtimebroker',
  'searchindexer','searchhost','sihost','taskhostw','ctfmon',
  'startmenuexperiencehost','shellexperiencehost','msmpeng',
  'securityhealthsystray','audiodg','spoolsv','msiexec','conhost',
  'dllhost','wuauclt','tiworker','trustedinstaller',
]);

async function scanBackgroundProcesses() {
  // 18000ms timeout: Get-Process on 100-200 procs plus JSON serialization can
  // exceed the 12000ms default on slower machines or cold starts.
  // Short property names (N/M/C) keep the JSON payload small.
  // Per-process try/catch on TotalProcessorTime prevents access-denied stderr
  // output from protected processes from corrupting the stdout buffer.
  const _procsScript = `
$out = @{Total=0;Mem=@();Cpu=@();Dups=@()}
try {
    $all = @(Get-Process -EA SilentlyContinue | Where-Object {$_} |
        Select-Object ProcessName, WorkingSet64,
            @{n='C';e={try{[math]::Round($_.TotalProcessorTime.TotalSeconds,1)}catch{0}}})
    $out.Total = $all.Count
    $out.Mem   = @($all | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 ProcessName,WorkingSet64,C)
    $out.Cpu   = @($all | Where-Object{$_.C -gt 5} | Sort-Object C -Descending | Select-Object -First 8 ProcessName,WorkingSet64,C)
    $out.Dups  = @($all | Group-Object ProcessName | Where-Object{$_.Count -ge 3} | Sort-Object {($_.Group | Measure-Object WorkingSet64 -Sum).Sum} -Descending | ForEach-Object { [PSCustomObject]@{N=$_.Name;Cnt=$_.Count;TotM=[math]::Round(($_.Group|Measure-Object WorkingSet64 -Sum).Sum/1MB,1)} } | Select-Object -First 6)
} catch {}
# Re-wrap each array with @() before serialising so ConvertTo-Json never collapses
# a single-element array into a bare object (which breaks Array.isArray on the JS side).
$serial = [PSCustomObject]@{Total=$out.Total;Mem=@($out.Mem);Cpu=@($out.Cpu);Dups=@($out.Dups)}
Write-Output ($serial | ConvertTo-Json -Compress -Depth 4)`;
  const _procsRaw = await pseFile('PROCS', _procsScript);
  const raw = tryJson(_procsRaw);

  if (!raw) {
    return { totalCount: null, topMemory: [], topCpu: [], duplicates: [], flagged: [] };
  }

  // Map PS property names to readable JS names, filter system procs.
  const mbOf = p => p.WorkingSet64 ? Math.round(p.WorkingSet64 / (1024*1024) * 10) / 10 : 0;
  const filterUser = arr => (arr || []).filter(p =>
    p && p.ProcessName && !SYSTEM_PROC_NAMES.has((p.ProcessName || '').toLowerCase())
  );

  const topMemory = filterUser(raw.Mem).slice(0, 6).map(p => ({
    name: p.ProcessName, memMB: mbOf(p), cpuSec: p.C ?? 0,
  }));
  const topCpu = filterUser(raw.Cpu).slice(0, 5).map(p => ({
    name: p.ProcessName, cpuSec: p.C, memMB: mbOf(p),
  }));
  // Normalise Dups: ConvertTo-Json can collapse a single-item @() to a bare object.
  // Wrap in array if needed, then map to the canonical { name, count, totalMemMB } shape.
  const rawDups = Array.isArray(raw.Dups) ? raw.Dups
    : (raw.Dups && typeof raw.Dups === 'object') ? [raw.Dups] : [];
  const duplicates = rawDups.map(d => ({
    name:       d.N   || d.name       || null,
    count:      d.Cnt ?? d.count      ?? null,
    totalMemMB: d.TotM ?? d.totalMemMB ?? null,
  })).filter(d => d.name !== null);

  // Flagged: user-visible procs in topMemory or topCpu that match known drains
  const allVisible = [...topMemory, ...topCpu];
  const seenFlagged = new Set();
  const flagged = [];
  for (const drain of KNOWN_BG_DRAINS) {
    const proc = allVisible.find(p => (p.name || '').toLowerCase().includes(drain.match));
    if (proc && !seenFlagged.has(proc.name)) {
      seenFlagged.add(proc.name);
      flagged.push({ name: proc.name, memMB: proc.memMB, reason: drain.reason });
    }
  }

  return {
    totalCount: typeof raw.Total === 'number' ? raw.Total : null,
    topMemory,
    topCpu,
    duplicates,
    flagged,
  };
}

// ── Finding factory ───────────────────────────────────────────────────────────

function fi(id, title, technical, plain, impact, sev, action, canAutomate, confidence = 85, isInfo = false) {
  return { id, title, technical, plain, impact, sev, action, canAutomate, confidence, isInfo };
}

function capSev(sev, confidence) {
  if (confidence < 60)  return 'info';
  if (confidence < 75)  return ['critical','high','medium'].includes(sev) ? 'low' : sev;
  if (confidence < 85 && sev === 'critical') return 'high';
  return sev;
}

// ── Category builder ──────────────────────────────────────────────────────────
// New dedicated module data (biosData, startupData, processData) is preferred
// when present. Legacy collector data is the fallback.

function buildCategories({
  cpu, gpu, osName, totalRamGB, diskResult,
  profile, storage, stability, perf, winHealth, winUpdate, drivers, network,
  biosData = null, startupData = null, processData = null, stabilityData = null,
}) {
  const cats     = [];
  const thisYear = new Date().getFullYear();

  // ── 1. YOUR PC ──────────────────────────────────────────────────────────────
  const sysF = [];

  sysF.push(fi('cpu','Processor (CPU)', cpu,
    `Your PC is powered by the ${cpu}. The processor handles everything from running Windows to loading game assets.`,
    'A faster CPU improves frame stability, game loading, and multitasking.',
    'ok','No action needed.',false,95,true));

  sysF.push(fi('gpu','Graphics Card (GPU)', gpu,
    `Your graphics card is the ${gpu}. It renders everything you see on screen and is the most important component for gaming performance.`,
    'The GPU determines what frame rates and graphical settings are achievable.',
    'ok','Keep your GPU driver updated through the NVIDIA, AMD, or Intel app.',false,95,true));

  sysF.push(fi('os','Operating System', osName,
    `Your PC is running ${osName}.`,
    'Keeping Windows updated ensures security patches and driver compatibility.',
    'ok','Keep Windows updated via Settings \u2192 Windows Update.',false,95,true));

  const ramSev = totalRamGB >= 16 ? 'ok' : totalRamGB >= 8 ? 'medium' : 'high';
  sysF.push(fi('ram','System RAM',`${totalRamGB} GB installed`,
    totalRamGB >= 16
      ? `You have ${totalRamGB} GB of RAM \u2014 a healthy amount for modern gaming and multitasking.`
      : totalRamGB >= 8
        ? `You have ${totalRamGB} GB of RAM. This works for most games, but 16 GB is the current gaming recommendation.`
        : `You only have ${totalRamGB} GB of RAM \u2014 below the minimum for most modern games.`,
    'Low RAM causes stuttering when games and background apps compete for memory.',
    ramSev,
    ramSev==='ok' ? 'No action needed.' : 'Upgrading to 16 GB RAM would noticeably improve gaming performance.',
    false,95,ramSev==='ok'));

  const { diskTotal, diskFree, diskUsedPct } = diskResult;
  if (diskTotal !== null) {
    const dSev = diskUsedPct >= 95 ? 'high' : diskUsedPct >= 85 ? 'medium' : 'ok';
    sysF.push(fi('disk-space','Storage Space (C: Drive)',`${diskTotal} GB total \u00b7 ${diskFree} GB free \u00b7 ${diskUsedPct}% used`,
      diskUsedPct >= 85
        ? `Your main drive is ${diskUsedPct}% full with only ${diskFree} GB remaining. Windows needs breathing room to run well.`
        : `Your main drive is ${diskUsedPct}% used with ${diskFree} GB free \u2014 plenty of space.`,
      'A nearly-full drive slows Windows and can prevent updates and game installs.',
      dSev, dSev==='ok' ? 'No action needed.' : 'Delete large unused files or move them to an external drive.',
      false,92,dSev==='ok'));
  }

  // Motherboard — prefer scanBiosMotherboard() data, fall back to collectSystemProfile()
  const _moboMfr   = biosData?.motherboard?.manufacturer || profile.moboMfr   || null;
  const _moboModel = biosData?.motherboard?.model        || profile.moboModel  || null;
  if (_moboMfr || _moboModel) {
    const mb = `${_moboMfr||''} ${_moboModel||''}`.trim();
    sysF.push(fi('mobo','Motherboard', mb,
      `Your motherboard is the ${mb}. It connects all of your PC's components and determines what upgrades are compatible.`,
      'Determines which CPUs, RAM, and expansion cards are compatible with your system.',
      'ok','No action needed.',false,90,true));
  }

  // BIOS — prefer scanBiosMotherboard() data, fall back to collectSystemProfile()
  const _biosVer  = biosData?.bios?.version  || profile.biosVersion || null;
  const _biosYear = biosData?.bios?.year     || profile.biosYear    || null;
  const _biosAge  = biosData?.bios?.age != null
    ? biosData.bios.age
    : (_biosYear ? thisYear - _biosYear : null);
  const _biosMfr  = biosData?.bios?.manufacturer || _moboMfr || null;

  if (_biosYear) {
    const bSev = _biosAge >= 7 ? 'low' : 'ok';
    sysF.push(fi('bios','BIOS Version',`${_biosVer||'Unknown'} (${_biosYear})`,
      _biosAge >= 7
        ? `Your BIOS is from ${_biosYear} \u2014 ${_biosAge} years old. Very old BIOS versions occasionally miss hardware fixes.`
        : `Your BIOS is from ${_biosYear}. This is fine.`,
      'BIOS updates occasionally fix hardware compatibility and stability issues.',
      bSev,
      _biosAge >= 7
        ? `Check ${_biosMfr||'your motherboard manufacturer'}'s website for BIOS updates. Only update if you're comfortable with the process.`
        : 'No action needed.',
      false,70,bSev==='ok'));
  }

  // Battery and display — from legacy collectSystemProfile()
  if (profile.isLaptop && profile.batteryPct !== null) {
    const bp = Number(profile.batteryPct);
    const batSev = bp < 15 ? 'medium' : bp < 25 ? 'low' : 'ok';
    sysF.push(fi('battery','Battery',`${bp}% charge`,
      bp < 25
        ? `Battery is at ${bp}%. On battery power, Windows reduces CPU speed to conserve energy \u2014 this affects gaming performance.`
        : `Battery is at ${bp}%.`,
      'A low battery causes Windows to throttle CPU and GPU speed.',
      batSev, bp < 25 ? 'Plug in before gaming or running demanding tasks.' : 'No action needed.',
      false,90,batSev==='ok'));
  }

  if (profile.monitorW && profile.monitorH) {
    const hz = profile.monitorHz ? ` @ ${profile.monitorHz}Hz` : '';
    sysF.push(fi('monitor','Display',`${profile.monitorW}\u00d7${profile.monitorH}${hz}`,
      `Your monitor is running at ${profile.monitorW}\u00d7${profile.monitorH}${hz}.`,
      'Higher resolutions and refresh rates require more GPU power.',
      'ok','No action needed.',false,90,true));
  }

  cats.push({ id:'system', title:'Your PC', icon:'\ud83d\udcbb', findings:sysF });

  // ── 2. STORAGE HEALTH ───────────────────────────────────────────────────────
  const storF = [];
  if (storage.disks && storage.disks.length > 0) {
    storage.disks.forEach((disk, i) => {
      const type     = (disk.MediaType        || 'Unknown').trim();
      const health   = (disk.HealthStatus      || 'Unknown').trim();
      const opStatus = (disk.OperationalStatus || '').trim();
      const sizeGB   = disk.Size ? Math.round(Number(disk.Size)/(1024**3)) : null;
      const label    = `Drive ${i+1}`;
      const isHDD    = type.toLowerCase().includes('hdd') || type==='Unspecified';
      const isHealthy= health.toLowerCase()==='healthy' || opStatus.toLowerCase()==='ok';

      storF.push(fi(`disk-type-${i}`,`${label} \u2014 Type`,
        `${type}${sizeGB ? ` \u00b7 ${sizeGB} GB` : ''}`,
        isHDD
          ? `Drive ${i+1} is a traditional hard drive (HDD). HDDs are slower than SSDs and cause longer game load times.`
          : `Drive ${i+1} is an SSD (${type}) \u2014 fast and ideal for Windows and game installs.`,
        'Drive type affects game load times and system responsiveness.',
        isHDD ? 'low' : 'ok',
        isHDD ? 'Consider installing Windows and frequently-played games on an SSD if possible.' : 'No action needed.',
        false,80,true));

      if (!isHealthy) {
        storF.push(fi(`disk-health-${i}`,`${label} \u2014 Health Warning`,
          `Health: ${health} \u00b7 Status: ${opStatus}`,
          `Drive ${i+1} is reporting a health issue (${health}). This is worth investigating soon.`,
          'A failing drive can cause data loss. Back up important files as soon as possible.',
          capSev('high',75),
          'Back up your important files as soon as possible. Open Command Prompt as Administrator and run: chkdsk C: /f',
          false,75));
      }
    });
  }
  if (!storF.length) {
    storF.push(fi('storage-na','Storage','No physical disks detected',
      'PCLabs could not read drive details on this scan.',
      'No impact from this specific check.',
      'info','No action needed.',false,50,true));
  }
  cats.push({ id:'storage', title:'Storage', icon:'\ud83d\udcbe', findings:storF });

  // ── 3. STABILITY & CRASHES ──────────────────────────────────────────────────
  // Prefer scanStability() structured data; fall back to legacy collectStability().
  const stabF = [];
  const bsod = stabilityData ? stabilityData.bsod.count  : Number(stability.BsodCount       || 0);
  const kp   = stabilityData ? stabilityData.kp.count    : Number(stability.KernelPowerCount || 0);
  const ac   = stabilityData ? stabilityData.appCrash.count7d : Number(stability.AppCrashCount || 0);
  const whea = stabilityData ? stabilityData.whea.count  : Number(stability.WheaCount        || 0);

  // ── Blue screens ──────────────────────────────────────────────────────────
  const bsodCodes = stabilityData?.bsod?.recent?.filter(e => e.code).slice(0,3) || [];
  const bsodCodeStr = bsodCodes.length > 0
    ? bsodCodes.map(e => e.codeName ? `${e.code} (${e.codeName})` : e.code).join(', ')
    : null;
  const bsodTechnical = bsod === 0
    ? '0 blue screens in the last 30 days'
    : bsodCodeStr ? `${bsod} BSOD${bsod!==1?'s':''} \u00b7 codes: ${bsodCodeStr}` : `${bsod} blue screen${bsod!==1?'s':''} recorded`;

  stabF.push(fi('bsod','Blue Screens (Last 30 Days)', bsodTechnical,
    bsod===0
      ? 'No blue screens in the last month. Your system is stable.'
      : bsod<=2
        ? `${bsod} blue screen${bsod!==1?'s':''} in the last month. Occasional BSODs can happen but are worth investigating.`
        : `${bsod} blue screens in the last 30 days \u2014 a pattern that usually points to a driver or hardware issue.`,
    'A blue screen means Windows crashed completely and restarted. Repeated BSODs indicate a driver fault, RAM problem, or hardware issue.',
    capSev(bsod===0?'ok':bsod<=2?'medium':'high',88),
    bsod===0
      ? 'No action needed.'
      : bsodCodes.some(e => e.codeName === 'VIDEO_TDR_FAILURE')
        ? 'Your GPU driver is the likely cause. Download the latest driver directly from NVIDIA, AMD, or Intel.'
        : bsodCodes.some(e => e.codeName === 'WHEA_UNCORRECTABLE_ERROR')
          ? 'Run Windows Memory Diagnostic from the Start menu. Check for CPU overheating. Update your BIOS if it is old.'
          : 'Update your GPU and chipset drivers. Run Windows Memory Diagnostic from the Start menu. Check your PC for overheating.',
    false,88,bsod===0));

  // ── Kernel power / unexpected shutdowns ──────────────────────────────────
  const kpCauses = stabilityData?.kp?.recent?.map(e => e.likelyCause).filter(Boolean) || [];
  const kpCrashRelated = kpCauses.some(c => c.toLowerCase().includes('crash'));
  stabF.push(fi('kernel-power','Unexpected Shutdowns (Last 30 Days)',
    kp===0 ? '0 unexpected shutdowns'
           : `${kp} unexpected shutdown${kp!==1?'s':''}${kpCrashRelated?' \u00b7 likely crash-related':''}`,
    kp===0
      ? 'No unexpected shutdowns detected. Your PC is powering off correctly.'
      : kpCrashRelated
        ? `Your PC shut down unexpectedly ${kp} time${kp!==1?'s':''} this month. The events appear to be crash-related rather than power-related.`
        : `Your PC lost power unexpectedly ${kp} time${kp!==1?'s':''} this month. This often points to overheating, a power supply issue, or a wall socket problem.`,
    'Unexpected shutdowns can corrupt open files and are a sign that something is wrong with power delivery or stability.',
    capSev(kp===0?'ok':kp<=2?'medium':'high',88),
    kp===0
      ? 'No action needed.'
      : kpCrashRelated
        ? 'Check your crash history for related blue screens. Update your drivers and run Windows Memory Diagnostic.'
        : 'Clean dust from your PC fans and ensure vents are clear. Try a different wall socket. If it continues, your power supply may need replacing.',
    false,88,kp===0));

  // ── App crashes ───────────────────────────────────────────────────────────
  const topCrashers = stabilityData?.appCrash?.topCrashers || [];
  const crashDetail = topCrashers.length > 0
    ? topCrashers.slice(0,2).map(c => `${c.name} (${c.count}×)`).join(', ')
    : null;
  const acSev = ac===0?'ok':ac<8?'ok':ac<20?'low':'medium';
  stabF.push(fi('app-crash','App Crashes (Last 7 Days)',
    ac===0 ? '0 app crashes this week'
           : crashDetail ? `${ac} crash${ac!==1?'es':''} \u00b7 top: ${crashDetail}` : `${ac} app crash${ac!==1?'es':''}`,
    ac===0
      ? 'No application crashes recorded this week.'
      : ac<8
        ? `${ac} app crash${ac!==1?'es':''} in the last 7 days. A small number is normal${crashDetail ? `, mainly from ${topCrashers[0]?.name}`:''}.`
        : `${ac} application crashes in the last 7 days \u2014 higher than usual${crashDetail ? `. The most frequent is ${topCrashers[0]?.name} (${topCrashers[0]?.count}×)`:''}. This is worth looking into.`,
    'Repeated crashes from a specific app usually mean it needs updating or reinstalling.',
    capSev(acSev,82),
    acSev==='ok'
      ? 'No action needed.'
      : topCrashers.length > 0
        ? `Try updating or reinstalling ${topCrashers[0]?.name}. Keep Windows up to date via Settings \u2192 Windows Update.`
        : 'Update Windows and your apps. If one app keeps crashing, try reinstalling it.',
    false,82,acSev==='ok'));

  // ── WHEA hardware errors ──────────────────────────────────────────────────
  if (whea > 0) {
    const wheaSrc = stabilityData?.whea?.sources?.slice(0,2).join(', ') || null;
    stabF.push(fi('whea','Hardware Error Events (WHEA)',
      wheaSrc ? `${whea} event${whea!==1?'s':''} \u00b7 source: ${wheaSrc}` : `${whea} event${whea!==1?'s':''} in the last 30 days`,
      `Windows logged ${whea} low-level hardware error${whea!==1?'s':''} recently. These events record correctable hardware faults and can appear on otherwise healthy systems.`,
      'WHEA events indicate the CPU, RAM, or chipset encountered a hardware error. A small count may be harmless; a rising count combined with BSODs is a stronger signal.',
      capSev(whea<5?'low':'medium',68),
      bsod > 0
        ? 'Combined with your blue screen history, run Windows Memory Diagnostic. Consider running memtest86 for a thorough RAM check.'
        : 'Monitor to see if the count grows. If you also start seeing blue screens, run Windows Memory Diagnostic from the Start menu.',
      false,68));
  }

  // ── Service failures ──────────────────────────────────────────────────────
  if (stabilityData && stabilityData.svcFail.count > 0) {
    const svcList = stabilityData.svcFail.services.slice(0,3).join(', ') || 'Unknown service';
    stabF.push(fi('svc-fail','Service Failures (Last 7 Days)',
      `${stabilityData.svcFail.count} service failure${stabilityData.svcFail.count!==1?'s':''} \u00b7 ${svcList}`,
      `Windows recorded ${stabilityData.svcFail.count} background service failure${stabilityData.svcFail.count!==1?'s':''} in the last week. Affected: ${svcList}.`,
      'Service failures can cause features to stop working unexpectedly or slow down background tasks.',
      capSev(stabilityData.svcFail.count>3?'medium':'low',72),
      'Restart your PC to allow failed services to recover. If failures repeat, check Windows Event Viewer \u2192 System log for more detail.',
      false,72));
  }

  cats.push({ id:'stability', title:'Stability & Crashes', icon:'\ud83d\udd27', findings:stabF });

  // ── 4. PERFORMANCE ──────────────────────────────────────────────────────────
  const perfF      = [];
  const cpuLoad    = perf.CpuLoad    !== undefined ? Number(perf.CpuLoad)    : null;
  const ramUsedPct = perf.RamUsedPct !== undefined ? Number(perf.RamUsedPct) : null;
  const powerPlan  = perf.PowerPlan  || null;
  const diskQ      = (perf.DiskQueueLen !== null && perf.DiskQueueLen !== undefined) ? Number(perf.DiskQueueLen) : null;
  const thermalCnt = Number(perf.ThermalCount || 0);
  const gameDVR    = perf.GameDVR;

  // ── Startup count — prefer scanStartupApps(), fall back to legacy ──────────
  const _startupCnt = startupData != null
    ? startupData.count
    : Number(perf.StartupCount || 0);

  const stSev = _startupCnt > 20 ? 'medium' : _startupCnt > 12 ? 'low' : 'ok';
  perfF.push(fi('startup','Startup Programs',`${_startupCnt} program${_startupCnt!==1?'s':''} launch at startup`,
    _startupCnt > 12
      ? `${_startupCnt} programs run automatically when Windows starts. Some are probably not needed and slow your boot time.`
      : _startupCnt > 7
        ? `${_startupCnt} startup programs. This is fine, though you might be able to trim a few.`
        : `${_startupCnt} startup programs \u2014 a healthy number.`,
    'Too many startup apps slow boot time and use CPU and RAM in the background.',
    capSev(stSev,90),
    _startupCnt > 12
      ? 'Open Task Manager \u2192 Startup apps tab and disable anything you don\'t need at boot (e.g. Spotify, Teams, Discord).'
      : 'No action needed.',
    false,90,stSev==='ok'));

  // ── Startup program details ────────────────────────────────────────────────
  if (startupData != null) {
    // New module path: use enriched item data
    const { heavyItems = [], items = [] } = startupData;
    if (heavyItems.length > 0) {
      const top5    = heavyItems.slice(0, 5);
      const names   = top5.map(i => i.name).join(', ');
      const hSev    = heavyItems.filter(i => i.impact === 'high').length >= 2 ? 'medium' : 'low';
      // Build a detail string using publisher when available
      const detail  = top5.map(i => {
        const pub = (i.publisher && i.publisher !== i.name) ? ` (${i.publisher})` : '';
        return i.reason ? `${i.name}${pub}: ${i.reason}` : `${i.name}${pub}`;
      }).join('; ');
      perfF.push(fi('startup-apps','Startup Programs \u2014 What\'s Running',
        names,
        `These programs start automatically with Windows: ${names}.\n\n${detail}.`,
        'Apps like Teams, Spotify, and Discord running at startup add boot time and use RAM before you open a single game.',
        capSev(hSev,82),
        'Open Task Manager \u2192 Startup apps. Right-click any app you don\'t need at boot and choose Disable. You can still open them manually.',
        false,82,false));
    } else if (items.length > 0) {
      const listed = items.slice(0, 5).map(i => i.name).join(', ');
      perfF.push(fi('startup-apps','Startup Programs \u2014 What\'s Running',
        listed + (items.length > 5 ? ` + ${items.length - 5} more` : ''),
        `Your startup programs include: ${listed}${items.length > 5 ? ` and ${items.length - 5} more` : ''}. None appear to be major resource consumers.`,
        'These are the programs that launch automatically when Windows starts.',
        'ok','No action needed.',false,82,true));
    }
  } else {
    // Legacy fallback: use perf.StartupNames
    const startupNames = Array.isArray(perf.StartupNames) ? perf.StartupNames : [];
    if (startupNames.length > 0) {
      const knownHeavy = ['teams','discord','slack','zoom','spotify','steam','epic games',
        'onedrive','dropbox','adobe','creative cloud','skype','icloud','origin',
        'battle.net','razer','corsair','logitech','geforce experience','xbox','whatsapp'];
      const foundHeavy = startupNames.filter(n =>
        knownHeavy.some(k => (n||'').toLowerCase().includes(k))
      );
      if (foundHeavy.length > 0) {
        const listed = foundHeavy.slice(0,5).join(', ');
        const hSev   = foundHeavy.length >= 4 ? 'medium' : 'low';
        perfF.push(fi('startup-apps','Startup Programs \u2014 What\'s Running',
          listed,
          `These programs start automatically with Windows: ${listed}. Each one loads into memory before you open anything.`,
          'Apps like Teams, Spotify and Discord in startup consume RAM before you open a single game.',
          capSev(hSev,82),
          'Open Task Manager \u2192 Startup apps. Right-click and Disable anything you don\'t need at boot.',
          false,82,false));
      } else if (stSev === 'ok') {
        const listed = startupNames.slice(0,4).join(', ');
        perfF.push(fi('startup-apps','Startup Programs \u2014 What\'s Running',
          listed + (startupNames.length > 4 ? ` + ${startupNames.length - 4} more` : ''),
          `Your startup programs include: ${listed}${startupNames.length > 4 ? ` and ${startupNames.length - 4} more` : ''}. None appear to be major resource consumers.`,
          'These are the programs that launch automatically when Windows starts.',
          'ok','No action needed.',false,82,true));
      }
    }
  }

  // ── CPU usage ─────────────────────────────────────────────────────────────
  if (cpuLoad !== null) {
    const cSev = cpuLoad>80?'high':cpuLoad>65?'medium':'ok';
    perfF.push(fi('cpu-load','CPU Usage (Right Now)',`${cpuLoad}% CPU in use`,
      cpuLoad>65
        ? `Your CPU is at ${cpuLoad}% while idle \u2014 something in the background is using a lot of processing power.`
        : `CPU at ${cpuLoad}% \u2014 ${cpuLoad<30?'very low, mostly idle.':'within a normal range.'}`,
      'High idle CPU means less processing power available when you launch a game.',
      capSev(cSev,78),
      cpuLoad>65 ? 'Open Task Manager \u2192 Processes, sort by CPU, and close anything unexpectedly high.' : 'No action needed.',
      false,78,cSev==='ok'));
  }

  // ── RAM usage ─────────────────────────────────────────────────────────────
  if (ramUsedPct !== null) {
    const rSev = ramUsedPct>85?'high':ramUsedPct>72?'medium':'ok';
    perfF.push(fi('ram-usage','RAM Usage (Right Now)',`${ramUsedPct}% RAM in use`,
      ramUsedPct>85
        ? `${ramUsedPct}% of your RAM is already in use before opening any games \u2014 very little headroom.`
        : ramUsedPct>72
          ? `${ramUsedPct}% RAM in use. A bit high \u2014 games may compete for memory.`
          : `${ramUsedPct}% RAM in use \u2014 healthy.`,
      'High background RAM usage leaves less memory for games, causing stuttering.',
      capSev(rSev,82),
      rSev==='ok' ? 'No action needed.' : 'Open Task Manager \u2192 Memory column and close apps you\'re not using.',
      false,82,rSev==='ok'));
  }

  // ── Background process analysis — prefer scanBackgroundProcesses(), fall back to legacy ──
  if (processData != null) {
    const { topMemory = [], flagged = [], totalCount = null } = processData;
    if (topMemory.length >= 2) {
      const top3   = topMemory.slice(0, 3);
      const summary = top3.map(p => `${p.name} (${p.memMB} MB)`).join(' \u00b7 ');
      const topMB   = top3.reduce((s, p) => s + (p.memMB || 0), 0);
      const bpSev   = (ramUsedPct !== null && ramUsedPct > 72 && topMB > 800) ? 'medium'
                    : (ramUsedPct !== null && ramUsedPct > 60) ? 'low'
                    : 'ok';

      let plainDesc = `The largest apps in memory right now: ${top3.map(p => `${p.name} using ${p.memMB} MB`).join(', ')}.`;
      if (flagged.length > 0) {
        const f = flagged[0];
        plainDesc += ` Note: ${f.name} \u2014 ${f.reason}.`;
      }

      perfF.push(fi('bg-procs','Background Memory Use',
        summary + (totalCount !== null ? ` \u00b7 ${totalCount} total processes` : ''),
        plainDesc,
        'These apps share your RAM with Windows. Closing unused apps before gaming frees memory and can reduce stuttering.',
        capSev(bpSev,80),
        bpSev === 'ok'
          ? 'No action needed \u2014 RAM headroom looks fine.'
          : 'Open Task Manager and close any apps from this list that you\'re not actively using.',
        false,80,bpSev==='ok'));
    }
  } else {
    // Legacy fallback: use perf.TopProcs
    const topProcs = Array.isArray(perf.TopProcs) ? perf.TopProcs : [];
    if (topProcs.length > 0) {
      const legacySystemProcs = new Set([
        'system','idle','memory compression','registry','smss','csrss','wininit',
        'services','lsass','svchost','dwm','winlogon','fontdrvhost','runtimebroker',
        'searchindexer','searchhost','sihost','taskhostw','ctfmon','startmenuexperiencehost',
        'shellexperiencehost','msmpeng','securityhealthsystray','audiodg',
      ]);
      const userProcs = topProcs.filter(p =>
        p && p.Name && !legacySystemProcs.has((p.Name||'').toLowerCase()) && (p.MemMB||0) > 30
      );
      if (userProcs.length >= 2) {
        const top3    = userProcs.slice(0,3);
        const summary = top3.map(p => `${p.Name} (${p.MemMB} MB)`).join(' \u00b7 ');
        const topMB   = top3.reduce((s,p) => s+(p.MemMB||0), 0);
        const bpSev   = (ramUsedPct !== null && ramUsedPct > 72 && topMB > 800) ? 'medium'
                      : (ramUsedPct !== null && ramUsedPct > 60) ? 'low'
                      : 'ok';
        perfF.push(fi('bg-procs','Background Memory Use',
          summary,
          `The largest apps in memory right now are: ${top3.map(p=>`${p.Name} using ${p.MemMB} MB`).join(', ')}.`,
          'These apps are sharing your RAM with Windows. If RAM pressure is high, closing unused apps frees memory for games.',
          capSev(bpSev,80),
          bpSev === 'ok'
            ? 'No action needed \u2014 RAM headroom looks fine.'
            : 'Open Task Manager and close any apps from this list that you\'re not actively using.',
          false,80,bpSev==='ok'));
      }
    }
  }

  // ── Disk queue ────────────────────────────────────────────────────────────
  if (diskQ !== null && diskQ > 2) {
    perfF.push(fi('disk-queue','Disk Activity',`Disk queue: ${diskQ} pending operations`,
      `Your drive is handling ${diskQ} pending operations. This suggests the drive is under pressure right now.`,
      'High disk queue causes lag when loading games or large files.',
      capSev(diskQ>5?'medium':'low',72),
      'Close any apps that might be downloading or writing large files. Check Task Manager \u2192 Disk column.',
      false,72));
  }

  // ── Thermal throttling ────────────────────────────────────────────────────
  if (thermalCnt > 0) {
    perfF.push(fi('thermal','Thermal Throttling Events',`${thermalCnt} event${thermalCnt!==1?'s':''} detected`,
      `Your PC has recently throttled its speed to control heat. It got hot enough that Windows had to slow it down.`,
      'Thermal throttling causes sudden FPS drops mid-game and means cooling needs attention.',
      capSev(thermalCnt>2?'medium':'low',78),
      'Clean dust from fans and vents. Make sure the PC has good airflow. Check the CPU cooler is seated properly.',
      false,78));
  }

  // ── Power plan ───────────────────────────────────────────────────────────
  if (powerPlan) {
    const pl = powerPlan.toLowerCase();
    const isSaver = pl.includes('saver') || pl.includes('battery');
    const ppSev = isSaver ? 'medium' : 'ok';
    perfF.push(fi('power-plan','Windows Power Plan', powerPlan,
      isSaver
        ? `Power plan is set to "${powerPlan}" \u2014 this intentionally limits CPU and GPU speed to save power.`
        : `Power plan: "${powerPlan}". This is fine for gaming.`,
      'A power-saving plan can artificially cap your CPU speed during gaming.',
      capSev(ppSev,88),
      isSaver ? 'Change to "High Performance" or "Balanced" via Settings \u2192 System \u2192 Power & Sleep \u2192 Additional power settings.' : 'No action needed.',
      false,88,ppSev==='ok'));
  }

  // ── Game DVR ─────────────────────────────────────────────────────────────
  if (gameDVR === true || gameDVR === 1) {
    perfF.push(fi('game-dvr','Xbox Game Bar Background Recording','Game DVR / background recording enabled',
      'Xbox Game Bar is set to continuously record gameplay in the background.',
      'Background recording uses GPU memory and CPU, reducing resources available for games.',
      capSev('low',75),
      'If you don\'t use Xbox recording, disable it: Settings \u2192 Gaming \u2192 Xbox Game Bar.',
      false,75));
  }

  cats.push({ id:'performance', title:'Performance', icon:'\u26a1', findings:perfF });

  // ── 5. WINDOWS HEALTH & SECURITY ────────────────────────────────────────────
  const winF = [];

  const pending = winUpdate.PendingCount !== undefined && winUpdate.PendingCount !== null
    ? Number(winUpdate.PendingCount) : null;
  if (pending !== null) {
    const uSev = pending>10?'medium':pending>0?'low':'ok';
    winF.push(fi('win-update','Windows Updates',
      pending===0 ? 'Up to date' : `${pending} update${pending!==1?'s':''} available`,
      pending===0 ? 'Windows is up to date.'
                  : `There ${pending===1?'is':'are'} ${pending} Windows update${pending!==1?'s':''} waiting to be installed.`,
      'Pending updates may include security fixes and stability improvements.',
      capSev(uSev,85),
      pending===0 ? 'No action needed.' : 'Open Settings \u2192 Windows Update and install available updates.',
      false,85,uSev==='ok'));
  }

  if (winHealth.Defender) {
    const def  = winHealth.Defender;
    const avOn = def.AntivirusEnabled===true || def.AntivirusEnabled==='True';
    const rtpOn= def.RealTimeProtectionEnabled===true || def.RealTimeProtectionEnabled==='True';
    const ok   = avOn && rtpOn;
    winF.push(fi('defender','Windows Defender',
      ok ? 'Antivirus on \u00b7 Real-time protection on' : 'Protection may be reduced',
      ok ? 'Windows Defender is active and protecting your PC in real time.'
         : 'Defender doesn\'t appear to be fully active. Your PC may have less protection than expected.',
      'Real-time antivirus protection catches threats before they can do damage.',
      capSev(ok?'ok':'high',90),
      ok ? 'No action needed.' : 'Open Settings \u2192 Privacy & Security \u2192 Windows Security and re-enable protection.',
      false,90,ok));
  }

  const rb = winHealth.PendingReboot;
  if (rb !== undefined && rb !== null) {
    const reboot = rb===true || rb==='True';
    winF.push(fi('reboot','Pending Restart',
      reboot ? 'Restart required' : 'No restart pending',
      reboot ? 'Windows has updates waiting that need a restart to take effect.'
             : 'No restart is pending.',
      'Without restarting, some security updates aren\'t fully applied.',
      capSev(reboot?'medium':'ok',82),
      reboot ? 'Restart your PC when it\'s convenient.' : 'No action needed.',
      false,82,!reboot));
  }

  const act = winHealth.Activated;
  if (act !== undefined && act !== null) {
    const activated = act===true || act==='True';
    winF.push(fi('activation','Windows Activation',
      activated ? 'Activated' : 'Not activated',
      activated ? 'Windows is properly activated.'
                : 'Windows is not activated. You\'ll see desktop watermarks and some settings will be locked.',
      'An unactivated copy limits personalisation and may affect long-term stability.',
      capSev(activated?'ok':'medium',82),
      activated ? 'No action needed.' : 'Go to Settings \u2192 System \u2192 Activation to activate Windows.',
      false,82,activated));
  }

  const avc = Number(winHealth.AvCount || 0);
  if (avc > 1) {
    winF.push(fi('av-conflict','Multiple Antivirus Programs',`${avc} antivirus products detected`,
      `${avc} antivirus programs are installed at the same time. They conflict with each other, causing high CPU usage and reduced protection.`,
      'Conflicting antivirus tools hurt performance and can reduce protection.',
      capSev('medium',72),
      'Keep only one antivirus. Windows Defender is recommended \u2014 uninstall any third-party antivirus from Settings \u2192 Apps.',
      false,72));
  }

  const sb = winHealth.SecureBoot;
  if (sb !== undefined && sb !== null) {
    const sbOn = sb===true || sb==='True';
    winF.push(fi('secure-boot','Secure Boot',
      sbOn ? 'Enabled' : 'Disabled or unsupported',
      sbOn ? 'Secure Boot is on. It prevents certain malware from loading before Windows.'
           : 'Secure Boot is disabled or not supported on this PC.',
      'Secure Boot protects against boot-level malware.',
      capSev(sbOn?'ok':'low',78),
      sbOn ? 'No action needed.' : 'Enable Secure Boot in BIOS/UEFI settings if your PC supports it.',
      false,78,sbOn));
  }

  if (winHealth.Tpm) {
    const tpm = winHealth.Tpm;
    const tOk = (tpm.TpmPresent===true||tpm.TpmPresent==='True') && (tpm.TpmEnabled===true||tpm.TpmEnabled==='True');
    winF.push(fi('tpm','TPM (Trusted Platform Module)',
      tOk ? 'Present and enabled' : 'Not detected or disabled',
      tOk ? 'TPM is present and enabled \u2014 required for Windows 11 and hardware encryption.'
          : 'TPM is not enabled. Some security features and Windows 11 require it.',
      'TPM is needed for Windows 11 compatibility and BitLocker encryption.',
      capSev(tOk?'ok':'low',75),
      tOk ? 'No action needed.' : 'Enable TPM in BIOS/UEFI settings (PTT on Intel, fTPM on AMD).',
      false,75,tOk));
  }

  if (winHealth.BitLocker !== null && winHealth.BitLocker !== undefined) {
    const blOn = String(winHealth.BitLocker)==='1' || String(winHealth.BitLocker).toLowerCase()==='on';
    winF.push(fi('bitlocker','Drive Encryption (BitLocker)',
      blOn ? 'Enabled on C:' : 'Not enabled',
      blOn ? 'BitLocker is encrypting your main drive. Your data is protected if the drive is removed.'
           : 'BitLocker is not enabled. If someone removes your drive, the data would be readable.',
      'Encryption protects personal files if a drive is stolen.',
      'ok','No action needed \u2014 this is a personal choice.',false,80,true));
  }

  const badDevices = Array.isArray(drivers?.ProblematicDevices) ? drivers.ProblematicDevices : [];
  const realBad    = badDevices.filter(d => d && d.FriendlyName && d.Status !== 'OK');
  if (realBad.length > 0) {
    winF.push(fi('drivers',`${realBad.length} Device Driver Problem${realBad.length!==1?'s':''}`,
      realBad.slice(0,3).map(d=>`${d.FriendlyName} (${d.Status})`).join(' \u00b7 '),
      `${realBad.length} device${realBad.length!==1?'s':''} in Device Manager ${realBad.length===1?'has':'have'} a driver problem. This usually means a driver is missing or broken.`,
      'Broken drivers can cause device failures, BSODs, or unexpected system behaviour.',
      capSev(realBad.length>2?'medium':'low',80),
      'Open Device Manager (right-click Start \u2192 Device Manager). Look for devices with a yellow warning icon and update or reinstall their drivers.',
      false,80));
  }

  cats.push({ id:'windows', title:'Windows Health & Security', icon:'\ud83d\udee1\ufe0f', findings:winF });

  // ── 6. NETWORK & ONLINE GAMING ──────────────────────────────────────────────
  const netF   = [];
  const adapters = network.Adapters;
  const hasVpn = network.HasVpn===true || network.HasVpn==='True';
  const lat    = (network.Latency!==null && network.Latency!==undefined) ? Number(network.Latency) : null;
  const loss   = (network.PacketLoss!==null && network.PacketLoss!==undefined) ? Number(network.PacketLoss) : null;

  const hostnameResolutionWorked =
    network.HostnameResolutionWorked === true ||
    network.HostnameResolutionWorked === 'True';
  const ipPingWorked = lat !== null && !isNaN(lat) && lat > 0;
  const collectorReturnedData = (
    network.HostnameResolutionWorked !== undefined ||
    network.Latency !== undefined
  );
  const dnsOk = !collectorReturnedData || hostnameResolutionWorked || ipPingWorked;
  const finalDnsProblem = (dnsOk === false);
  const connectivityVerified = dnsOk;

  if (Array.isArray(adapters) && adapters.length > 0) {
    const p     = adapters[0];
    const desc  = ((p.InterfaceDescription||'')+(p.Name||'')).toLowerCase();
    const isWifi= p.PhysicalMediaType==='Native 802.11' || desc.includes('wi-fi') || desc.includes('wireless');
    netF.push(fi('connection','Connection Type',`${p.Name} \u00b7 ${p.LinkSpeed||'Unknown speed'}`,
      isWifi
        ? 'You\'re connected over Wi-Fi. Wi-Fi is convenient but can be less stable than Ethernet for online gaming.'
        : 'You\'re connected via Ethernet \u2014 the best connection type for online gaming.',
      'Wired Ethernet gives lower and more consistent latency than Wi-Fi.',
      isWifi ? 'low' : 'ok',
      isWifi ? 'If you\'re experiencing lag in games, try an Ethernet cable for a more stable connection.'
             : 'No action needed \u2014 wired connection is ideal.',
      false,82,!isWifi));
  } else if (connectivityVerified) {
    netF.push(fi('connection','Network Connection','Adapter details unavailable \u2014 connectivity confirmed',
      'PCLabs couldn\'t read adapter details, but your internet connection is working.',
      'No issue \u2014 your connection is active.',
      'info','No action needed.',false,70,true));
  } else {
    netF.push(fi('connection','Network Connection','No active connection detected',
      'No active network connection was detected. This scan may have been run offline.',
      'Internet access is needed for game downloads, driver updates, and online gaming.',
      capSev('low',60),
      'Check your network cable or Wi-Fi settings. Open a browser to confirm your connection.',
      false,60));
  }

  if (lat !== null && !isNaN(lat) && lat > 0) {
    const lSev = lat<80?'ok':lat<150?'medium':'high';
    netF.push(fi('latency','Internet Ping',`${lat}ms average to 8.8.8.8`,
      lat<30  ? `Excellent ping of ${lat}ms \u2014 very responsive.`
      :lat<80  ? `Good ping of ${lat}ms \u2014 suitable for most online games.`
      :lat<150 ? `Moderate ping of ${lat}ms \u2014 may cause noticeable lag in fast-paced games.`
               : `High ping of ${lat}ms \u2014 this will likely cause lag in online games.`,
      'High latency causes lag and delayed reactions in multiplayer games.',
      capSev(lSev,82),
      lat>=80 ? 'Try a wired Ethernet connection, restart your router, or pick game servers closer to your location.'
              : 'No action needed.',
      false,82,lSev==='ok'));
  }

  if (loss !== null && loss > 0) {
    const loSev = loss>=25?'high':loss>=10?'medium':'low';
    netF.push(fi('packet-loss','Packet Loss',`${loss}% packet loss detected`,
      `${loss}% of test packets were lost during this scan. Even small amounts of packet loss cause rubber-banding in online games.`,
      'Packet loss causes rubber-banding, disconnections, and unreliable online connections.',
      capSev(loSev,80),
      'Restart your router. If on Wi-Fi, move closer or switch to Ethernet. Contact your ISP if the problem persists.',
      false,80));
  }

  if (hasVpn) {
    netF.push(fi('vpn','VPN Active','VPN or tunnel adapter detected',
      'A VPN is running on your PC. VPNs route traffic through extra servers, which adds latency.',
      'Active VPNs increase ping and can sometimes interfere with anti-cheat software.',
      'low',
      'Disable your VPN when gaming unless you specifically need it.',
      false,72));
  }

  cats.push({ id:'network', title:'Network & Online Gaming', icon:'\ud83c\udf10', findings:netF });

  return cats;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function summarise(categories, totalRamGB, gpu) {
  let score  = 85;
  const all  = categories.flatMap(c => c.findings);
  const ord  = { critical:0, high:1, medium:2, low:3, info:4, ok:5 };

  for (const f of all) {
    if (f.isInfo || f.sev==='ok' || f.sev==='info') continue;
    const conf = (f.confidence||85)/100;
    if      (f.sev==='critical') score -= 20*conf;
    else if (f.sev==='high')     score -= 11*conf;
    else if (f.sev==='medium')   score -= 5 *conf;
    else if (f.sev==='low')      score -= 1 *conf;
  }

  const issueFindings = all
    .filter(f => !f.isInfo && ['critical','high','medium'].includes(f.sev))
    .sort((a,b) => (ord[a.sev]??9) - (ord[b.sev]??9));

  const issueCount = issueFindings.length;

  const issues = issueFindings
    .slice(0,3)
    .map(f => ({ sev: f.sev==='critical' ? 'high' : f.sev, title: f.title, desc: f.impact }));
  if (!issues.length) issues.push({ sev:'ok', title:'No major issues found', desc:'Your system looks healthy.' });

  let n=1;
  const actions=[
    ...issueFindings
      .filter(f => f.action && !f.action.startsWith('No action'))
      .slice(0,3)
      .map(f => ({ n:String(n++).padStart(2,'0'), title:f.title, desc:f.action })),
    { n:String(n).padStart(2,'0'), title:'Keep Windows up to date', desc:'Settings \u2192 Windows Update.' },
  ].slice(0,4);

  const noIssues   = issueCount === 0;
  const finalScore = Math.min(Math.max(Math.round(score),30), noIssues?100:96);

  const gl=gpu.toLowerCase();
  const gpuHigh =['rtx 3','rtx 4','rtx 5','rx 6','rx 7','rx 9','arc a7'].some(k=>gl.includes(k));
  const gpuMid  =['nvidia','geforce','amd','radeon','rtx','gtx'].some(k=>gl.includes(k));
  const gpuIntel=['intel','arc','uhd','iris'].some(k=>gl.includes(k));
  const gpuReal = gpuMid||gpuIntel;

  let readiness;
  if      (gpuHigh  && totalRamGB>=16) readiness='Excellent';
  else if (gpuMid   && totalRamGB>=8)  readiness='Good';
  else if (gpuIntel && totalRamGB>=16) readiness='Good';
  else if (totalRamGB<8 || !gpuReal)   readiness='Needs Work';
  else                                 readiness='Fair';

  return { finalScore, readiness, issues, actions, issueCount };
}

// ── Scan handler ──────────────────────────────────────────────────────────────

ipcMain.handle('run-scan', async () => {
  // Run all collectors and dedicated modules in parallel.
  // Legacy collectors are kept alongside new modules during the transition period.
  const [
    cpu, gpu, osName, diskResult,
    profile, storage, stability, perf, winHealth, winUpdate, drivers, network,
    biosData, startupData, processData, stabilityData,
  ] = await Promise.all([
    detectCpu(), detectGpu(), detectOs(), detectDisk(),
    collectSystemProfile(), collectStorage(), collectStability(),
    collectPerformance(), collectWindowsHealth(), collectWindowsUpdate(),
    collectDrivers(), collectNetwork(),
    scanBiosMotherboard(), scanStartupApps(), scanBackgroundProcesses(),
    scanStability(),
  ]);

  const totalRamGB = Math.round(os.totalmem()  / (1024**3));
  const freeRamGB  = parseFloat((os.freemem()   / (1024**3)).toFixed(1));
  const usedRamGB  = parseFloat(((os.totalmem()-os.freemem()) / (1024**3)).toFixed(1));
  const { diskTotal, diskFree, diskUsedPct } = diskResult;

  const categories = buildCategories({
    cpu, gpu, osName, totalRamGB, diskResult,
    profile, storage, stability, perf, winHealth, winUpdate, drivers, network,
    biosData, startupData, processData, stabilityData,
  });
  const { finalScore, readiness, issues, actions, issueCount } = summarise(categories, totalRamGB, gpu);

  return {
    cpu, gpu,
    ram:  `${totalRamGB} GB total \u00b7 ${usedRamGB} GB used \u00b7 ${freeRamGB} GB free`,
    os:   osName,
    disk: diskTotal !== null
            ? `${diskTotal} GB total \u00b7 ${diskFree} GB free \u00b7 ${diskUsedPct}% used`
            : 'Unable to read',
    score: finalScore, readiness, issues, actions, issueCount, categories,
    // Structured module results — available for future UI panels and reporting
    biosMotherboard:     biosData,
    startupApps:         startupData,
    backgroundProcesses: processData,
    stabilityReport:     stabilityData,
  };
});

// ── Report export ─────────────────────────────────────────────────────────────

ipcMain.handle('save-report', async (event, html) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title:       'Save PCLabs Report',
    defaultPath: `PCLabs-Report-${new Date().toISOString().slice(0,10)}.html`,
    filters:     [{ name: 'HTML Report', extensions: ['html'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, html, 'utf8');
    shell.openPath(filePath);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── Junk Scanner ──────────────────────────────────────────────────────────────
ipcMain.handle('run-junk-scan', async () => {
  // $ErrorActionPreference = SilentlyContinue prevents PowerShell from
  // accumulating non-terminating errors into the error stream and exiting
  // non-zero from -File mode, which was causing pseFile to resolve null.
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$results = @()

# 1. User Temp
$p = $env:TEMP
$size = 0
try { $s = (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='usertemp'; label='Temp Files (%TEMP%)'; path=$p; sizeBytes=[long]$size }

# 2. Windows Temp
$p = 'C:\\Windows\\Temp'
$size = 0
try { $s = (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='wintemp'; label='Windows Temp'; path=$p; sizeBytes=[long]$size }

# 3. Windows Update Cache
$p = 'C:\\Windows\\SoftwareDistribution\\Download'
$size = 0
try { $s = (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='wupdate'; label='Windows Update Cache'; path=$p; sizeBytes=[long]$size }

# 4. Crash Dumps
$size = 0
$dpaths = @('C:\\Windows\\Minidump', "$env:LOCALAPPDATA\\CrashDumps", 'C:\\Windows\\MEMORY.DMP')
foreach ($dp in $dpaths) {
  try { $s = (Get-ChildItem $dp -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size += $s } } catch {}
}
$results += [PSCustomObject]@{ id='crashdumps'; label='Crash Dumps & Error Logs'; path='Multiple locations'; sizeBytes=[long]$size }

# 5. Thumbnail Cache
$p = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer"
$size = 0
try { $s = (Get-ChildItem $p -Filter 'thumbcache_*.db' -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='thumbcache'; label='Thumbnail & Icon Cache'; path=$p; sizeBytes=[long]$size }

# 6. Recycle Bin (all drives)
$size = 0
try {
  $shell = New-Object -ComObject Shell.Application
  $bin = $shell.Namespace(0xA)
  foreach ($item in $bin.Items()) { try { $size += $item.Size } catch {} }
} catch {}
$results += [PSCustomObject]@{ id='recyclebin'; label='Recycle Bin'; path='All drives'; sizeBytes=[long]$size }

# 7. Chrome Cache
$p = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache"
$size = 0
try { $s = (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='chromecache'; label='Chrome Cache'; path=$p; sizeBytes=[long]$size }

# 8. Edge Cache
$p = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"
$size = 0
try { $s = (Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size = $s } } catch {}
$results += [PSCustomObject]@{ id='edgecache'; label='Edge Cache'; path=$p; sizeBytes=[long]$size }

# 9. Firefox Cache
$size = 0
try {
  $ffProfiles = Get-ChildItem "$env:APPDATA\\Mozilla\\Firefox\\Profiles" -Directory -ErrorAction SilentlyContinue
  foreach ($prof in $ffProfiles) {
    $cp = Join-Path $prof.FullName 'cache2'
    try { $s = (Get-ChildItem $cp -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($null -ne $s) { $size += $s } } catch {}
  }
} catch {}
$results += [PSCustomObject]@{ id='firefoxcache'; label='Firefox Cache'; path='Firefox profiles'; sizeBytes=[long]$size }

$totalBytes = ($results | Measure-Object sizeBytes -Sum).Sum
if ($null -eq $totalBytes) { $totalBytes = 0 }
@{ categories=$results; totalBytes=[long]$totalBytes } | ConvertTo-Json -Compress -Depth 4
`;

  // Use a direct exec (same pattern as run-junk-clean) so stdout is returned
  // even when PowerShell exits non-zero — pseFile's `err ? null` pattern
  // was discarding valid JSON output whenever privileged directory access
  // caused PowerShell to record a non-terminating error and exit non-zero.
  const tmpPath = path.join(os.tmpdir(), `pclabs_JUNK_SCAN_${Date.now()}.ps1`);
  try { fs.writeFileSync(tmpPath, script, 'utf8'); } catch(e) {
    return { categories: [], totalMB: 0 };
  }

  const rawStr = await new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPath}"`,
      { timeout: 30000 },
      (err, stdout) => {
        try { fs.unlinkSync(tmpPath); } catch(_) {}
        resolve((stdout || '').trim() || null);
      }
    );
  });

  const raw = tryJson(rawStr);
  if (!raw) return { categories: [], totalMB: 0 };

  const categories = Array.isArray(raw.categories) ? raw.categories.map(c => ({
    id:        c.id    || '',
    label:     c.label || '',
    path:      c.path  || '',
    sizeBytes: Number(c.sizeBytes || 0),
    sizeMB:    parseFloat((Number(c.sizeBytes || 0) / (1024 * 1024)).toFixed(1)),
  })) : [];

  const totalMB = parseFloat((Number(raw.totalBytes || 0) / (1024 * 1024)).toFixed(1));
  return { categories, totalMB };
});

// ── Junk Cleaner ──────────────────────────────────────────────────────────────
ipcMain.handle('run-junk-clean', async (_, selectedIds) => {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  if (!ids.length) return { cleaned: [], totalFreedMB: 0 };

  const script = `
param([string]$IdsJson)
$ErrorActionPreference = 'SilentlyContinue'
$ids = $IdsJson | ConvertFrom-Json
$results = @()

function TryDelete($path, $recurse) {
  $freed = 0
  try {
    if ($recurse) {
      $items = Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue
      foreach ($item in $items) { try { $freed += $item.Length; Remove-Item $item.FullName -Force -ErrorAction SilentlyContinue } catch {} }
    } else {
      $items = Get-ChildItem $path -Force -ErrorAction SilentlyContinue
      foreach ($item in $items) { try { $freed += $item.Length; Remove-Item $item.FullName -Force -Recurse -ErrorAction SilentlyContinue } catch {} }
    }
  } catch {}
  return [long]$freed
}

foreach ($id in $ids) {
  $freed = 0
  switch ($id) {
    'usertemp'    { $freed = TryDelete $env:TEMP $true }
    'wintemp'     { $freed = TryDelete 'C:\\Windows\\Temp' $false }
    'wupdate'     {
      try { Stop-Service wuauserv -Force -ErrorAction SilentlyContinue } catch {}
      $freed = TryDelete 'C:\\Windows\\SoftwareDistribution\\Download' $false
      try { Start-Service wuauserv -ErrorAction SilentlyContinue } catch {}
    }
    'crashdumps'  {
      foreach ($dp in @('C:\\Windows\\Minidump',"$env:LOCALAPPDATA\\CrashDumps")) {
        $freed += TryDelete $dp $false
      }
      try { $f='C:\\Windows\\MEMORY.DMP'; if(Test-Path $f){$freed+=(Get-Item $f).Length; Remove-Item $f -Force -EA SilentlyContinue} } catch {}
    }
    'thumbcache'  {
      $p = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer"
      try {
        Get-ChildItem $p -Filter 'thumbcache_*.db' -Force -EA SilentlyContinue | ForEach-Object {
          try { $freed += $_.Length; Remove-Item $_.FullName -Force -EA SilentlyContinue } catch {}
        }
      } catch {}
    }
    'recyclebin'  {
      try { $before=(Get-PSDrive C).Used; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; $freed=0 } catch {}
    }
    'chromecache' { $freed = TryDelete "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache" $true }
    'edgecache'   { $freed = TryDelete "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache" $true }
    'firefoxcache'{
      try {
        $ffProfiles = Get-ChildItem "$env:APPDATA\\Mozilla\\Firefox\\Profiles" -Directory -EA SilentlyContinue
        foreach ($prof in $ffProfiles) { $freed += TryDelete (Join-Path $prof.FullName 'cache2') $true }
      } catch {}
    }
  }
  $results += [PSCustomObject]@{ id=$id; freedBytes=[long]$freed }
}

$totalFreed = ($results | Measure-Object freedBytes -Sum).Sum
@{ cleaned=$results; totalFreedBytes=[long]$totalFreed } | ConvertTo-Json -Compress -Depth 3
`;

  const tmpFile = path.join(os.tmpdir(), 'pclabs_junk_clean.ps1');
  try { fs.writeFileSync(tmpFile, script, 'utf8'); } catch(e) { return { cleaned: [], totalFreedMB: 0 }; }

  const idsJson = JSON.stringify(ids).replace(/"/g, '\\"');
  const raw = await new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}" -IdsJson "${idsJson}"`,
      { timeout: 60000 },
      (err, stdout) => {
        try { fs.unlinkSync(tmpFile); } catch(_) {}
        resolve((stdout || '').trim() || null);
      }
    );
  });

  const result = tryJson(raw);
  if (!result) return { cleaned: [], totalFreedMB: 0 };

  const cleaned = Array.isArray(result.cleaned) ? result.cleaned.map(c => ({
    id:       c.id || '',
    freedMB:  parseFloat((Number(c.freedBytes || 0) / (1024 * 1024)).toFixed(1)),
  })) : [];

  const totalFreedMB = parseFloat((Number(result.totalFreedBytes || 0) / (1024 * 1024)).toFixed(1));
  return { cleaned, totalFreedMB };
});

// ── Game Detector ─────────────────────────────────────────────────────────────
ipcMain.handle('run-game-detect', async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$games = @()

# Steam
try {
  $steamPath = $null
  # 1. HKCU (most common)
  try { $steamPath = (Get-ItemProperty 'HKCU:\\SOFTWARE\\Valve\\Steam' -EA Stop).SteamPath } catch {}
  # 2. HKLM WOW6432Node
  if (-not $steamPath) {
    try { $steamPath = (Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Valve\\Steam' -EA Stop).InstallPath } catch {}
  }
  # 3. HKLM native
  if (-not $steamPath) {
    try { $steamPath = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Valve\\Steam' -EA Stop).InstallPath } catch {}
  }
  # 4. Default filesystem paths
  if (-not $steamPath) {
    $steamDefaults = @(
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      'D:\\Steam',
      'D:\\Program Files (x86)\\Steam'
    )
    foreach ($p in $steamDefaults) {
      if (Test-Path (Join-Path $p 'steamapps')) { $steamPath = $p; break }
    }
  }
  if ($steamPath) { $steamPath = $steamPath -replace '/', '\\' }
  $libraryPaths = @()
  $drives = (Get-PSDrive -PSProvider FileSystem -EA SilentlyContinue).Root
  $steamSubFolders = @(
    'Program Files (x86)\\Steam\\steamapps',
    'Program Files\\Steam\\steamapps',
    'Steam\\steamapps',
    'SteamLibrary\\steamapps',
    'Games\\Steam\\steamapps',
    'Games\\SteamLibrary\\steamapps'
  )
  foreach ($drive in $drives) {
    foreach ($sf in $steamSubFolders) {
      $candidate = Join-Path $drive.TrimEnd('\\') $sf
      if (Test-Path $candidate) { $libraryPaths += $candidate }
    }
  }
  $defaultLib = Join-Path $steamPath 'steamapps'
  if ($steamPath -and (Test-Path $defaultLib) -and ($libraryPaths -notcontains $defaultLib)) {
    $libraryPaths += $defaultLib
  }
  foreach ($lib in $libraryPaths) {
    if (-not (Test-Path $lib)) { continue }
    $acfFiles = @(Get-ChildItem $lib -Filter 'appmanifest_*.acf' -EA SilentlyContinue)
    foreach ($acf in $acfFiles) {
      $content = Get-Content $acf.FullName -Raw -EA SilentlyContinue
      $nameMatch = [regex]::Match($content, '"name"\s*[\t ]+\s*"([^"]+)"')
      $appIdMatch = [regex]::Match($acf.Name, 'appmanifest_(\d+)\.acf')
      if ($nameMatch.Success) {
        $games += [PSCustomObject]@{
          name=$nameMatch.Groups[1].Value
          launcher='Steam'
          appId=if($appIdMatch.Success){$appIdMatch.Groups[1].Value}else{''}
          exePath=''
        }
      }
    }
  }
} catch {}

# Epic Games
try {
  $epicPath = "$env:PROGRAMDATA\\Epic\\EpicGamesLauncher\\Data\\Manifests"
  if (Test-Path $epicPath) {
    Get-ChildItem $epicPath -Filter '*.item' -EA SilentlyContinue | ForEach-Object {
      $json = Get-Content $_.FullName -Raw -EA SilentlyContinue | ConvertFrom-Json -EA SilentlyContinue
      if ($json -and $json.DisplayName) {
        $games += [PSCustomObject]@{
          name=$json.DisplayName
          launcher='Epic Games'
          appId=$json.AppName
          exePath=if($json.LaunchExecutable -and $json.InstallLocation){"$($json.InstallLocation)\\$($json.LaunchExecutable)"}else{''}
        }
      }
    }
  }
} catch {}

# Xbox Game Pass
try {
  $xboxPkgs = Get-AppxPackage -EA SilentlyContinue | Where-Object { $_.SignatureKind -eq 'Store' -and $_.PackageUserInformation -and $_.Name -notlike 'Microsoft.*' -and $_.PackageFamilyName -notlike 'Microsoft.*' }
  foreach ($pkg in ($xboxPkgs | Select-Object -First 15)) {
    $manifest = Join-Path $pkg.InstallLocation 'AppxManifest.xml'
    if (Test-Path $manifest) {
      [xml]$xml = Get-Content $manifest -EA SilentlyContinue
      $displayName = $xml.Package.Properties.DisplayName
      if ($displayName -and $displayName -notlike 'ms-resource:*') {
        $games += [PSCustomObject]@{ name=$displayName; launcher='Xbox'; appId=$pkg.PackageFamilyName; exePath='' }
      }
    }
  }
} catch {}

# Battle.net
try {
  $bnPath = "$env:PROGRAMDATA\\Battle.net\\Agent\\product.db"
  $bnInstallPath = (Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\Battle.net\\Capabilities' -EA SilentlyContinue).ApplicationName
  if ($null -ne $bnInstallPath) {
    $knownBnGames = @('World of Warcraft','Diablo IV','Overwatch 2','Hearthstone','Starcraft II','Call of Duty')
    foreach ($gname in $knownBnGames) {
      $checkPaths = @(
        "C:\\Program Files (x86)\\$gname",
        "C:\\Program Files\\$gname"
      )
      foreach ($cp in $checkPaths) {
        if (Test-Path $cp) {
          $games += [PSCustomObject]@{ name=$gname; launcher='Battle.net'; appId=$gname; exePath='' }
          break
        }
      }
    }
  }
} catch {}

# EA App / Origin
try {
  $eaLocalPath = "$env:LOCALAPPDATA\\Electronic Arts"
  $originPath  = "$env:PROGRAMDATA\\Origin\\LocalContent"
  $eaPaths = @()
  if (Test-Path $eaLocalPath) { $eaPaths += Get-ChildItem $eaLocalPath -Directory -EA SilentlyContinue | ForEach-Object { $_.Name } }
  if (Test-Path $originPath)  {
    Get-ChildItem $originPath -Directory -EA SilentlyContinue | ForEach-Object {
      $mfst = Get-ChildItem $_.FullName -Filter '*.mfst' -EA SilentlyContinue | Select-Object -First 1
      if ($mfst) { $eaPaths += $_.Name }
    }
  }
  foreach ($gname in ($eaPaths | Select-Object -First 10)) {
    $games += [PSCustomObject]@{ name=$gname; launcher='EA App'; appId=$gname; exePath='' }
  }
} catch {}

# Ubisoft Connect
try {
  $ubiDirs = @('C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games')
  $ubiReg = (Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher' -EA SilentlyContinue).InstallDir
  if ($ubiReg) { $ubiDirs += (Join-Path $ubiReg 'games') }
  foreach ($ubiPath in $ubiDirs) {
    if (Test-Path $ubiPath) {
      Get-ChildItem $ubiPath -Directory -EA SilentlyContinue | ForEach-Object {
        $games += [PSCustomObject]@{ name=$_.Name; launcher='Ubisoft Connect'; appId=$_.Name; exePath='' }
      }
    }
  }
} catch {}

# GOG Galaxy
try {
  $gogRegBase = 'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games'
  if (Test-Path $gogRegBase) {
    Get-ChildItem $gogRegBase -EA SilentlyContinue | ForEach-Object {
      $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
      $gname = $props.gameName
      if (-not $gname) { $gname = $props.GAMENAME }
      if ($gname) {
        $games += [PSCustomObject]@{ name=$gname; launcher='GOG Galaxy'; appId=$_.PSChildName; exePath='' }
      }
    }
  } else {
    $gogFallback = 'C:\\Program Files (x86)\\GOG Galaxy\\Games'
    if (Test-Path $gogFallback) {
      Get-ChildItem $gogFallback -Directory -EA SilentlyContinue | ForEach-Object {
        $games += [PSCustomObject]@{ name=$_.Name; launcher='GOG Galaxy'; appId=$_.Name; exePath='' }
      }
    }
  }
} catch {}

# Riot Games
try {
  $riotPaths = @(
    @{ path='C:\\Riot Games\\League of Legends';      name='League of Legends' },
    @{ path='C:\\Riot Games\\VALORANT';               name='VALORANT' },
    @{ path='C:\\Riot Games\\Teamfight Tactics';      name='Teamfight Tactics' },
    @{ path='C:\\Program Files\\Riot Games\\League of Legends'; name='League of Legends' },
    @{ path='C:\\Program Files\\Riot Games\\VALORANT';          name='VALORANT' }
  )
  $riotSeen = @{}
  foreach ($entry in $riotPaths) {
    if ((Test-Path $entry.path) -and -not $riotSeen[$entry.name]) {
      $riotSeen[$entry.name] = $true
      $games += [PSCustomObject]@{ name=$entry.name; launcher='Riot Games'; appId=$entry.name; exePath='' }
    }
  }
} catch {}

# Rockstar Games Launcher
try {
  $rockstarDir = (Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Rockstar Games\\Launcher' -EA SilentlyContinue).InstallFolder
  $rockstarKnown = @('GTA V','Grand Theft Auto V','Red Dead Redemption 2','GTA IV','Grand Theft Auto IV')
  $rockstarSeen = @{}
  if ($rockstarDir -and (Test-Path $rockstarDir)) {
    Get-ChildItem $rockstarDir -Directory -EA SilentlyContinue | ForEach-Object {
      $games += [PSCustomObject]@{ name=$_.Name; launcher='Rockstar Games'; appId=$_.Name; exePath='' }
      $rockstarSeen[$_.Name] = $true
    }
  }
  foreach ($gname in $rockstarKnown) {
    $checkPaths = @("C:\\Program Files\\Rockstar Games\\$gname","C:\\Program Files (x86)\\Rockstar Games\\$gname")
    foreach ($cp in $checkPaths) {
      if ((Test-Path $cp) -and -not $rockstarSeen[$gname]) {
        $rockstarSeen[$gname] = $true
        $games += [PSCustomObject]@{ name=$gname; launcher='Rockstar Games'; appId=$gname; exePath='' }
        break
      }
    }
  }
} catch {}

# Xbox Game Pass — filesystem scan
try {
  $xboxDir = 'C:\\XboxGames'
  if (Test-Path $xboxDir) {
    Get-ChildItem $xboxDir -Directory -EA SilentlyContinue | ForEach-Object {
      $games += [PSCustomObject]@{ name=$_.Name; launcher='Xbox'; appId=$_.Name; exePath='' }
    }
  }
} catch {}

# Minecraft
try {
  $mcPaths = @("$env:APPDATA\\.minecraft","$env:APPDATA\\com.mojang")
  foreach ($mcp in $mcPaths) {
    if (Test-Path $mcp) {
      $games += [PSCustomObject]@{ name='Minecraft'; launcher='Microsoft'; appId='Minecraft'; exePath='' }
      break
    }
  }
} catch {}

@{ games=@($games | Select-Object -First 100); count=$games.Count } | ConvertTo-Json -Compress -Depth 4
`;

  const raw = tryJson(await pseFile('GAME_DETECT', script, 45000));
  if (!raw) return { games: [], count: 0 };
  const games = Array.isArray(raw.games) ? raw.games
    .filter(g => g && g.name && String(g.name).trim())
    .map(g => ({
      name:     String(g.name).trim(),
      launcher: String(g.launcher || 'Unknown').trim(),
      appId:    String(g.appId || '').trim(),
    })) : [];

  return { games, count: games.length };
});

// ── Game Optimizer ────────────────────────────────────────────────────────────
ipcMain.handle('run-game-optimize', async (_, opts) => {
  // opts: { optimizations: ['hags','powerplan','gamebar','fullscreen','nagle'] }
  const selected = Array.isArray(opts?.optimizations) ? opts.optimizations : [];
  if (!selected.length) return { applied: [], errors: [] };

  const script = `
param([string]$OptsJson)
$opts = $OptsJson | ConvertFrom-Json
$applied = @()
$errors  = @()

foreach ($opt in $opts) {
  switch ($opt) {

    'gamebar' {
      try {
        $regPath = 'HKCU:\\SOFTWARE\\Microsoft\\GameBar'
        if (-not (Test-Path $regPath)) { New-Item $regPath -Force | Out-Null }
        Set-ItemProperty $regPath 'UseNexusForGameBarEnabled' 0 -Type DWord -Force
        Set-ItemProperty $regPath 'AllowAutoGameMode' 0 -Type DWord -Force
        $applied += 'gamebar'
      } catch { $errors += "gamebar: $_" }
    }

    'hags' {
      try {
        $regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'
        if (-not (Test-Path $regPath)) { New-Item $regPath -Force | Out-Null }
        Set-ItemProperty $regPath 'HwSchMode' 2 -Type DWord -Force
        $applied += 'hags'
      } catch { $errors += "hags: $_" }
    }

    'powerplan' {
      try {
        $hpGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
        powercfg /setactive $hpGuid 2>$null
        $applied += 'powerplan'
      } catch { $errors += "powerplan: $_" }
    }

    'fullscreen' {
      try {
        $regPath = 'HKCU:\\System\\GameConfigStore'
        if (-not (Test-Path $regPath)) { New-Item $regPath -Force | Out-Null }
        Set-ItemProperty $regPath 'GameDVR_FSEBehaviorMode' 2 -Type DWord -Force
        Set-ItemProperty $regPath 'GameDVR_HonorUserFSEBehaviorMode' 1 -Type DWord -Force
        Set-ItemProperty $regPath 'GameDVR_EFSEFeatureFlags' 0 -Type DWord -Force
        $applied += 'fullscreen'
      } catch { $errors += "fullscreen: $_" }
    }

    'visualfx' {
      try {
        Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' 'VisualFXSetting' 2 -Type DWord -Force
        $applied += 'visualfx'
      } catch { $errors += "visualfx: $_" }
    }

    'nagle' {
      try {
        $adapters = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -EA SilentlyContinue
        foreach ($adapter in $adapters) {
          Set-ItemProperty $adapter.PSPath 'TcpAckFrequency' 1 -Type DWord -Force -EA SilentlyContinue
          Set-ItemProperty $adapter.PSPath 'TCPNoDelay' 1 -Type DWord -Force -EA SilentlyContinue
        }
        $applied += 'nagle'
      } catch { $errors += "nagle: $_" }
    }

  }
}

@{ applied=@($applied); errors=@($errors) } | ConvertTo-Json -Compress -Depth 3
`;

  const tmpFile = path.join(os.tmpdir(), 'pclabs_game_opt.ps1');
  try { fs.writeFileSync(tmpFile, script, 'utf8'); } catch(e) { return { applied: [], errors: ['Failed to write script'] }; }

  const optsJson = JSON.stringify(selected).replace(/"/g, '\\"');
  const raw = await new Promise(resolve => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}" -OptsJson "${optsJson}"`,
      { timeout: 30000 },
      (err, stdout) => {
        try { fs.unlinkSync(tmpFile); } catch(_) {}
        resolve((stdout || '').trim() || null);
      }
    );
  });

  const result = tryJson(raw);
  if (!result) return { applied: [], errors: ['Script returned no output'] };

  return {
    applied: Array.isArray(result.applied) ? result.applied : [],
    errors:  Array.isArray(result.errors)  ? result.errors  : [],
  };
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform!=='darwin') app.quit(); });