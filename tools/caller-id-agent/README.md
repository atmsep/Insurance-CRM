# Caller ID Agent

Runs on a Windows PC at the office, connected via USB to a Caller-ID modem
on the analog phone line. When a call rings in, it sends the caller's
number to the CRM, which shows a popup with the client's name (if found) in
every open CRM tab.

**This is a separate small program, not part of the website.** A website
cannot read a phone line directly — this script is the bridge between the
physical line and the CRM.

## What to buy

Look for a **USB voice/fax modem with Caller ID (CID/CLIP) support**, not a
dedicated "Caller ID box" (those usually use their own private protocol).
Before buying, check the listing/spec sheet explicitly mentions:

- Caller ID support for **Europe / ETSI FSK** (not only the US Bellcore
  standard — some cheap modems only support the US one, which won't work on
  a Greek OTE line).
- A USB connection that shows up as a **virtual COM port** on Windows.

Plug the modem's phone-line jack into the same wall socket as your existing
analog phone (a splitter works fine), and the USB end into the PC.

## Setup

1. Plug in the modem, let Windows install its driver, then check
   **Device Manager → Ports (COM & LPT)** for the COM port it was assigned
   (e.g. `COM3`).
2. Install [Node.js](https://nodejs.org) on that PC if it isn't already.
3. In this folder, run:
   ```
   npm install
   ```
4. Open `agent.js` and edit the `CONFIG` block near the top:
   - `COM_PORT` — the port from step 1.
   - `CALLER_ID_SECRET` — the same value set as `CALLER_ID_SECRET` in the
     CRM's Vercel environment variables.
5. Run it:
   ```
   node agent.js
   ```
6. Call the office line from your mobile phone. You should see
   `Caller ID received: ...` printed, and a toast should appear in the CRM
   in your browser.

If step 6 doesn't show anything, run `set DEBUG_RAW=1 && node agent.js`
(Windows) to print everything the modem sends, so the parsing in
`agent.js` can be adjusted to match your exact modem's wording.

## Running it automatically

Once confirmed working, set it to start automatically so it survives a PC
restart. Use `run-agent.ps1` in this folder for the Task Scheduler action —
**don't** point the task straight at `cmd /c node agent.js`. A task action of
`cmd /c "<path with spaces>" agent.js >> "<log path>" 2>&1` hits a classic
`cmd.exe` quoting quirk (the leading quoted path plus more quotes later on
the line confuses its parser) and, worse, when it *does* launch, the task's
own console is what Task Scheduler signals to stop the task — which showed
up as the agent dying seconds after every start with
`STATUS_CONTROL_C_EXIT` in the task's History tab. `run-agent.ps1` sidesteps
both: it uses `Start-Process` to launch `node agent.js` fully detached, with
its own window (hidden) and its own console, then exits — so the scheduled
task itself completes immediately (successfully) and Node keeps running
independently, outside Task Scheduler's process tree.

```powershell
$wrapperScript = "<full path to>\tools\caller-id-agent\run-agent.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden

Register-ScheduledTask -TaskName "CRM Caller ID Agent" -Action $action -Trigger $trigger -Settings $settings -Description "Bridges the USB Caller-ID modem to the CRM's incoming-call popup." -Force
Start-ScheduledTask -TaskName "CRM Caller ID Agent"
```

Output goes to `agent.log` / `agent-error.log` in this folder (both
gitignored — they can contain caller phone numbers).

Alternatively, a small process manager like [pm2](https://pm2.keymetrics.io/)
or [nssm](https://nssm.cc/) can run it as a proper Windows service instead.
