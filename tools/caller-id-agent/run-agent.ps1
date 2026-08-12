# Launches agent.js fully detached from whatever process started this
# script (Task Scheduler, a console, etc.). Start-Process here creates an
# independent process with its own console, so it can't be reached by a
# Ctrl+C (or console-close signal) sent to this script's own console the
# way "cmd /c node agent.js" can — that was causing the scheduled task to
# die seconds after every start (STATUS_CONTROL_C_EXIT in Task Scheduler's
# history, an inherited-console problem, not a modem/CRM problem).
$nodeExe = "C:\Program Files\nodejs\node.exe"
$scriptDir = $PSScriptRoot
$logFile = Join-Path $scriptDir "agent.log"
$errorLogFile = Join-Path $scriptDir "agent-error.log"

Start-Process -FilePath $nodeExe `
  -ArgumentList "agent.js" `
  -WorkingDirectory $scriptDir `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorLogFile `
  -WindowStyle Hidden
