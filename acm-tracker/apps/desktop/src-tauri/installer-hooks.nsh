!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM acm-tracker-desktop.exe /T'
  Sleep 800
!macroend
