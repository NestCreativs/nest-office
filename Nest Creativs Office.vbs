' Nest Creativs Office: starts the local server with NO terminal window,
' then opens it in your default browser. Double-click this instead of start.bat.
Dim sh, fso, here
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here

' Launch the server hidden (0 = no window, False = don't wait).
sh.Run "node """ & here & "\server.js""", 0, False

' Give it a moment to boot, then open the dashboard in the default browser.
WScript.Sleep 1200
CreateObject("Shell.Application").ShellExecute "http://localhost:4600"
