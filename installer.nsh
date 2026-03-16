!macro customHeader
  LangString appCannotBeClosed ${LANG_ENGLISH} "$\n${PRODUCT_NAME} cannot be closed. Please try one of the following:$\n $\nIf running in background: Go to your system tray (arrow icon at bottom-right corner next to the clock), right-click the Downlodr icon, and select 'Quit'$\n $\nIf not running in background: Simply close the Downlodr window using the 'X' button or close button.$\n $\nThis will allow you to continue the installation."
  RequestExecutionLevel admin
!macroend

!macro customInstallMode
  ; Overrides the default NSIS macro for handling install modes.
  ; Forces NSIS into the per-user installation mode.
  
  ; This sets the variable that forces the install mode.
  StrCpy $isForceCurrentInstall "1"
  StrCpy $isForceMachineInstall "0"
  
  ; The following definitions are optional, but customize the text 
  ; of the install mode page to match the per-user-only behavior.
  !define MUI_INSTALLMODE_TITLE "Choose Installation Options"
  !define MUI_INSTALLMODE_INSTALL_TEXT "Please confirm to install this software just for you."
  !define MUI_INSTALLMODE_INSTALLED "just for me"
!macroend

!macro customUnInstall
  DetailPrint "Stopping background process..."
  nsExec::ExecToStack 'taskkill /F /IM "Downlodr.exe" /T'
!macroend
