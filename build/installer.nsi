; Per-user Windows x64 installer. Electron Builder provides OutFile/version/icon defines.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "${PRODUCT_NAME}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Phone Second Shop POS"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
SetCompressor zlib
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro addLangs

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Windows x64 is required."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Windows 10 or later is required."
    Abort
  ${EndIf}
  FindWindow $0 "Chrome_WidgetWin_1" "Phone Second Shop POS"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Close Phone Second Shop POS before installing or upgrading."
    Abort
  ${EndIf}
FunctionEnd

Section "Install"
  SetShellVarContext current
  SetRegView 64
  SetOutPath "$INSTDIR"
  ClearErrors
  ; Reuse Electron Builder's already-compressed, x64 application archive.
  ; Do not spend another compression pass on the complete Electron runtime.
  InitPluginsDir
  SetCompress off
  File /oname=$PLUGINSDIR\app.7z "${APP_64}"
  SetCompress auto
  SetOutPath "$PLUGINSDIR\unpacked"
  Nsis7z::Extract "$PLUGINSDIR\app.7z"
  IfFileExists "$PLUGINSDIR\unpacked\Phone Second Shop POS.exe" +3
    MessageBox MB_OK|MB_ICONSTOP "Application package extraction failed."
    Abort
  IfFileExists "$PLUGINSDIR\unpacked\resources\app.asar" +3
    MessageBox MB_OK|MB_ICONSTOP "Application package is incomplete."
    Abort
  ClearErrors
  SetOutPath "$INSTDIR"
  CopyFiles /SILENT "$PLUGINSDIR\unpacked\*" "$INSTDIR"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "Application files could not be installed. Close the application and retry."
    Abort
  ${EndIf}
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Phone Second Shop POS"
  CreateShortcut "$SMPROGRAMS\Phone Second Shop POS\Phone Second Shop POS.lnk" "$INSTDIR\Phone Second Shop POS.exe"
  CreateShortcut "$DESKTOP\Phone Second Shop POS.lnk" "$INSTDIR\Phone Second Shop POS.exe"
  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "Phone Second Shop POS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "Myominaung"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\Phone Second Shop POS.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1
SectionEnd

Function un.onInit
  FindWindow $0 "Chrome_WidgetWin_1" "Phone Second Shop POS"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Close Phone Second Shop POS before uninstalling. Business data will be retained."
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  SetRegView 64
  !include "${BUILD_RESOURCES_DIR}\uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$SMPROGRAMS\Phone Second Shop POS\Phone Second Shop POS.lnk"
  RMDir "$SMPROGRAMS\Phone Second Shop POS"
  Delete "$DESKTOP\Phone Second Shop POS.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  DeleteRegKey HKCU "Software\${APP_ID}"
  ; RMDir is intentionally non-recursive: leave any user-added files intact.
  RMDir "$INSTDIR"
  ; Never delete $APPDATA\Phone Second Shop POS or backups.
SectionEnd
