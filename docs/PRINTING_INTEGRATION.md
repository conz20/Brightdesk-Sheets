# Brightdesk Sheets printing integration

## Shared implementation

Sheets uses the checked-in, dependency-free snapshot of `@brightdesk/printing` from `conz20/Brightdesk-Printing`. The source snapshot records its upstream commit in `src/printing-package/UPSTREAM.json`.

The Electron main process creates one adapter per `webContents` instance. Six narrow IPC operations are registered only for the authorized main window: list configured printers, discover network printers, pair a discovered WSD printer, query capabilities, open system printer settings and submit a print request. The preload exposes only those operations through the context-isolated `brightdesk.printing` API.

The Print action first reads the operating-system queue list. When a queue is available, the adapter uses Electron's visible print dialog. Brightdesk does not silently add a queue, pair a device, install a driver or upload document contents to an external service.

## Native discovery and packaging

- macOS builds `native/macos/ipp-printer-discovery.swift` with Apple's Swift compiler and Network framework. The macOS Info.plist declares `_ipp._tcp`, `_ipps._tcp`, `_printer._tcp` and the local-network usage description.
- Windows builds `native/windows/ipp-printer-discovery.cpp` from Visual Studio Developer PowerShell with the Windows SDK and C++ Build Tools. It uses WinDNS for IPP/IPPS/LPD discovery and Windows DeviceWatcher for present WSD printer endpoints and user-approved pairing.
- Linux uses the host CUPS `ippfind` utility for advertised network printers. Configured queues remain available through Electron even if `ippfind` is missing.

`scripts/build-printing-native.js` selects the native helper for the build host. Standalone product builds must run on their matching platform so a macOS, Windows or Linux installer does not contain a helper compiled for a different operating system. The Windows and macOS native helper executables are listed in electron-builder's `asarUnpack` configuration.

## Verification

The automated virtual-printer tests verify configured-queue handling, capability reporting, successful OS submission and rejection handling. Integration tests also verify that the snapshot, IPC, preload API, Print actions, build script and installer metadata are present and included in `npm test`.

A virtual printer is not physical hardware. The status `submitted` means the operating system accepted the request; it does not confirm that paper was printed. Windows and Linux native builds and real-printer tests remain separate platform-verification requirements. No check is reported as passed unless its workflow actually ran and completed successfully.
