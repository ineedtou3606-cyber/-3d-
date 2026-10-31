#ifndef UNICODE
#define UNICODE
#endif
#include <windows.h>
/* Windows APIs only: no extra C runtime dependency. */
static wchar_t directory[32768], command[32768];
static STARTUPINFOW start;
static PROCESS_INFORMATION process;
void mainCRTStartup(void) {
    DWORD length = GetModuleFileNameW(NULL, directory, 32768);
    if (!length || length >= 12000) ExitProcess(1);
    DWORD last = length;
    while (last > 0 && directory[last] != L'\\') --last;
    if (!last) ExitProcess(1);
    directory[last] = L'\0';
    if (!SetCurrentDirectoryW(directory)) ExitProcess(1);
    SetConsoleTitleW(L"Sarok - History Studio");
    lstrcpyW(command, L"\"");
    lstrcatW(command, directory);
    lstrcatW(command, L"\\runtime\\python.exe\" \"");
    lstrcatW(command, directory);
    lstrcatW(command, L"\\app\\desktop.py\"");
    start.cb = sizeof(start);
    if (!CreateProcessW(NULL, command, NULL, NULL, FALSE, 0, NULL, directory, &start, &process)) {
        MessageBoxW(NULL, L"Unzip the entire Sarok folder, then run Sarok.exe again.", L"Sarok", MB_OK | MB_ICONERROR);
        ExitProcess(1);
    }
    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(process.hProcess, &code);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    ExitProcess(code);
}
