Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell -ExecutionPolicy Bypass -File ""C:\Users\admin\run_excel_analysis.ps1""", 0, True
