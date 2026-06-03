# Dumps visible windows and a shallow UI Automation tree for the legacy Character Builder.
# Run while CBLoader / D&D Insider Character Builder is open:
#   powershell -ExecutionPolicy Bypass -File tools/cb-explore.ps1

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

$titlePatterns = @(
  "Character Builder",
  "CBLoader",
  "Dungeons.*Dragons",
  "D&D Insider"
)

Write-Host "=== Visible top-level windows (title contains Character/CB/D&D) ===" -ForegroundColor Cyan
$windowMatches = New-Object System.Collections.Generic.List[object]

[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
  $len = [Win32]::GetWindowTextLength($hWnd)
  if ($len -eq 0) { return $true }
  $sb = New-Object System.Text.StringBuilder ($len + 1)
  [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
  $title = $sb.ToString()
  foreach ($pat in $titlePatterns) {
    if ($title -match $pat) {
      $windowMatches.Add([pscustomobject]@{ Handle = "0x{0:X}" -f $hWnd.ToInt64(); Title = $title })
      break
    }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null

if ($windowMatches.Count -eq 0) {
  Write-Host "No matching windows. Is Character Builder running?" -ForegroundColor Yellow
  Write-Host "Showing ALL visible windows with non-empty titles:" -ForegroundColor Yellow
  [Win32]::EnumWindows({
    param([IntPtr]$hWnd, [IntPtr]$lParam)
    if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
    $len = [Win32]::GetWindowTextLength($hWnd)
    if ($len -eq 0) { return $true }
    $sb = New-Object System.Text.StringBuilder ($len + 1)
    [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
    Write-Host ("  {0}  {1}" -f ("0x{0:X}" -f $hWnd.ToInt64()), $sb.ToString())
    return $true
  }, [IntPtr]::Zero) | Out-Null
  exit 0
}

$windowMatches | Format-Table -AutoSize

$excludeTitle = '(?i)(cursor|visual studio|code|chrome|firefox|edge|4e_builder)'
$cbPreferred = $windowMatches | Where-Object {
  $_.Title -match '(?i)(insider|cbloader)' -and $_.Title -notmatch $excludeTitle
}
$targetTitle = if ($cbPreferred.Count -gt 0) {
  ($cbPreferred | Select-Object -First 1).Title
} else {
  ($windowMatches | Where-Object { $_.Title -notmatch $excludeTitle } | Select-Object -First 1).Title
}
if (-not $targetTitle) {
  Write-Host "Only non-CB windows matched; open Character Builder and retry." -ForegroundColor Yellow
  exit 0
}
Write-Host "`n=== UI Automation tree (depth 3) for: $targetTitle ===" -ForegroundColor Cyan

try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
} catch {
  Write-Host "UIAutomation assemblies unavailable: $_" -ForegroundColor Red
  exit 1
}

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty,
  $targetTitle
)
$cb = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $cb) {
  Write-Host "Could not attach UI Automation to window by exact title." -ForegroundColor Yellow
  exit 0
}

function Show-Tree($el, $depth, $maxDepth) {
  if ($depth -gt $maxDepth) { return }
  $indent = "  " * $depth
  $ct = $el.Current.ControlType.ProgrammaticName -replace "ControlType.", ""
  $name = $el.Current.Name
  $aid = $el.Current.AutomationId
  $cls = $el.Current.ClassName
  $line = "$indent[$ct]"
  if ($name) { $line += " Name=`"$name`"" }
  if ($aid) { $line += " Id=`"$aid`"" }
  if ($cls) { $line += " Class=`"$cls`"" }
  Write-Host $line
  $children = $el.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($child in $children) {
    Show-Tree $child ($depth + 1) $maxDepth
  }
}

Show-Tree $cb 0 3
Write-Host "`nDone. Paste this output into your session notes if useful." -ForegroundColor Green
