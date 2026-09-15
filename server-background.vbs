' Nest Creativs Office — starts ONLY the server, hidden, with no browser window.
' Used by the Windows startup entry so the hub is always running in the
' background. To open the dashboard, use the Desktop shortcut or go to
' http://localhost:4600
Dim sh, fso, here
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
sh.Run "node """ & here & "\server.js""", 0, False
