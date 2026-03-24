/**
 * N-API module entry point for wavloom_vst3_host.
 *
 * When VST3_SDK_AVAILABLE is defined, exports the full host API.
 * Otherwise, exports a stub with just getVersion() for build verification.
 */

#include <napi.h>

#ifdef VST3_SDK_AVAILABLE
#include "napi_plugin_wrapper.h"
#endif

// ---- Plugin Crash Guard (Windows) ----
// VST3 plugins may crash on background threads (e.g., sample loading, streaming engines).
// Without protection, unhandled exceptions on ANY thread terminate the entire Electron process.
//
// We use AddVectoredExceptionHandler (VEH) instead of SetUnhandledExceptionFilter because
// Chromium's crashpad overrides the unhandled exception filter. VEH cannot be overridden.
//
// For background (non-main) threads with fatal exceptions, we redirect execution to
// ExitThread(), killing only the offending thread while keeping the host process alive.

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <csignal>
#include <cstdlib>
#include <cstdio>
#include <exception>

static DWORD g_mainThreadId = 0;

// Rate-limit main-thread crash recovery to prevent infinite loops
static volatile LONG g_mainThreadRecoveryCount = 0;
static volatile LONGLONG g_mainThreadRecoveryWindowStart = 0;
static const LONG MAX_RECOVERIES_PER_WINDOW = 100000; // Effectively unlimited — pure redirect is safe

// Dummy buffer for READ AV recovery: instead of zeroing the dest register (which causes
// cascading WRITE AVs when the value is used as a buffer pointer), point it to this
// writable page. Downstream stores go here harmlessly.
static void* g_dummyPage = nullptr;
static const size_t DUMMY_PAGE_SIZE = 65536; // 64KB — plenty for any buffer fill loop

// After a .vst3 crash recovery, also catch secondary crashes at non-.vst3 addresses
// for a brief window (cascading failures from the recovered frame's caller)
static volatile LONGLONG g_lastPluginRecoveryTime = 0;
static const LONGLONG RECOVERY_CASCADE_WINDOW_MS = 500;

static LONGLONG GetTimeMs() {
    LARGE_INTEGER freq, now;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&now);
    return (now.QuadPart * 1000) / freq.QuadPart;
}

// Check if an address falls inside a .vst3 plugin module
static bool IsAddressInVST3Module(void* addr) {
    HMODULE hModule = nullptr;
    if (!GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            (LPCWSTR)addr, &hModule)) {
        return false;
    }
    wchar_t modulePath[MAX_PATH] = {};
    if (!GetModuleFileNameW(hModule, modulePath, MAX_PATH)) return false;
    // Check if module path contains ".vst3" (case-insensitive)
    for (wchar_t* p = modulePath; *p; ++p) *p = towlower(*p);
    return wcsstr(modulePath, L".vst3") != nullptr;
}

// Parse ModR/M byte and advance p past SIB + displacement.
static void AdvancePastModRM(const BYTE*& p) {
    BYTE modrm = *p++;
    BYTE mod = (modrm >> 6) & 3;
    BYTE rm = modrm & 7;
    if (rm == 4 && mod != 3) p++;  // SIB byte
    if (mod == 0 && rm == 5) p += 4;       // [RIP+disp32]
    else if (mod == 1) p += 1;              // [reg+disp8]
    else if (mod == 2) p += 4;              // [reg+disp32]
}

// Determine the length of an x64 instruction at the given address.
// Handles: standard ALU/MOV/LEA, two-byte 0F, VEX (C4/C5 for AVX), EVEX (62 for AVX-512).
// Returns 0 if unknown.
static int GetX64InstructionLength(const BYTE* ip) {
    const BYTE* p = ip;

    // --- VEX prefix (AVX/AVX2) ---
    if (*p == 0xC5) {
        // 2-byte VEX: C5 [byte] [opcode] [ModR/M ...]
        p += 2; // C5 + VEX byte
        p++;     // opcode
        AdvancePastModRM(p);
        return (int)(p - ip);
    }
    if (*p == 0xC4) {
        // 3-byte VEX: C4 [byte1] [byte2] [opcode] [ModR/M ...]
        p += 3; // C4 + 2 VEX bytes
        p++;     // opcode
        AdvancePastModRM(p);
        return (int)(p - ip);
    }
    // --- EVEX prefix (AVX-512) ---
    if (*p == 0x62) {
        p += 4; // 62 + 3 EVEX bytes
        p++;     // opcode
        AdvancePastModRM(p);
        return (int)(p - ip);
    }

    // --- Legacy prefixes ---
    bool scanning = true;
    while (scanning) {
        switch (*p) {
            case 0x66: case 0x67: case 0xF2: case 0xF3:
            case 0x26: case 0x2E: case 0x36: case 0x3E: case 0x64: case 0x65:
                p++; break;
            default: scanning = false;
        }
    }
    // REX prefix
    BYTE opcode;
    if (*p >= 0x40 && *p <= 0x4F) p++;
    opcode = *p++;

    // Two-byte opcode (0F xx)
    if (opcode == 0x0F) {
        p++; // opcode2
        AdvancePastModRM(p);
        return (int)(p - ip);
    }

    // Single-byte opcodes with ModR/M
    if ((opcode >= 0x00 && opcode <= 0x03) ||
        (opcode >= 0x08 && opcode <= 0x0B) ||
        (opcode >= 0x20 && opcode <= 0x23) ||
        (opcode >= 0x28 && opcode <= 0x2B) ||
        (opcode >= 0x30 && opcode <= 0x33) ||
        (opcode >= 0x38 && opcode <= 0x3B) ||
        opcode == 0x85 || opcode == 0x87 ||
        opcode == 0x89 || opcode == 0x8B ||
        opcode == 0x8D || opcode == 0xFF ||
        (opcode >= 0x80 && opcode <= 0x83)) {
        AdvancePastModRM(p);
        if (opcode == 0x80) p += 1;
        else if (opcode == 0x81) p += 4;
        else if (opcode == 0x83) p += 1;
        return (int)(p - ip);
    }

    return 0; // Unknown
}

// NOP-patch the crashing instruction and zero the destination register in context.
// On first crash: patches instruction with NOPs so future calls skip it.
// Also adjusts the context to skip the instruction and zero the dest register for THIS call.
// Returns true if recovery succeeded.
static bool PatchAndSkipCrashInstruction(EXCEPTION_POINTERS* exInfo) {
#ifdef _M_X64
    BYTE* ip = (BYTE*)exInfo->ExceptionRecord->ExceptionAddress;
    int instrLen = GetX64InstructionLength(ip);

    if (instrLen < 1 || instrLen > 15) {
        fprintf(stderr, "[WavLoom] Unknown instruction at 0x%llX — cannot patch\n",
                (unsigned long long)(DWORD64)ip);
        fflush(stderr);
        return false;
    }

    // Determine AV type: 0=READ, 1=WRITE, 8=DEP
    ULONG_PTR avType = 0;
    if (exInfo->ExceptionRecord->NumberParameters >= 2) {
        avType = exInfo->ExceptionRecord->ExceptionInformation[0];
    }

    // Check if this is a VEX/EVEX encoded instruction (AVX/AVX2/AVX-512)
    bool isVexEncoded = (ip[0] == 0xC5 || ip[0] == 0xC4 || ip[0] == 0x62);

    fprintf(stderr, "[WavLoom] Patching %d-byte %s instruction at 0x%llX with NOPs (AV=%s)\n",
            instrLen, isVexEncoded ? "VEX" : "legacy",
            (unsigned long long)(DWORD64)ip,
            avType == 0 ? "READ" : avType == 1 ? "WRITE" : "DEP");
    fflush(stderr);

    // For WRITE AVs: the store silently doesn't happen (NOPed). No register adjustment needed.
    // For VEX READ AVs: destination is YMM/XMM — non-critical for control flow, just skip.
    // For legacy READ AVs: set the destination GP register to the dummy page address.
    // This prevents cascading WRITE AVs when the loaded value is used as a buffer pointer.
    if (!isVexEncoded && avType == 0) {
        // Determine the destination register from the instruction
        const BYTE* p = ip;
        while (*p >= 0x40 && *p <= 0x4F) p++; // REX
        while (*p == 0x66 || *p == 0x67 || *p == 0xF2 || *p == 0xF3 ||
               *p == 0x26 || *p == 0x2E || *p == 0x36 || *p == 0x3E ||
               *p == 0x64 || *p == 0x65) p++; // Legacy
        BYTE rex = (ip[0] >= 0x40 && ip[0] <= 0x4F) ? ip[0] : 0;
        p++; // Skip opcode
        if (p < ip + instrLen) {
            BYTE modrm = *p;
            int regField = ((modrm >> 3) & 7) | ((rex & 0x04) ? 8 : 0);
            // Register encoding: 0=RAX,1=RCX,2=RDX,3=RBX,4=RSP,5=RBP,6=RSI,7=RDI,8-15=R8-R15
            DWORD64* regMap[] = {
                &exInfo->ContextRecord->Rax, &exInfo->ContextRecord->Rcx,
                &exInfo->ContextRecord->Rdx, &exInfo->ContextRecord->Rbx,
                &exInfo->ContextRecord->Rsp, &exInfo->ContextRecord->Rbp,
                &exInfo->ContextRecord->Rsi, &exInfo->ContextRecord->Rdi,
                &exInfo->ContextRecord->R8,  &exInfo->ContextRecord->R9,
                &exInfo->ContextRecord->R10, &exInfo->ContextRecord->R11,
                &exInfo->ContextRecord->R12, &exInfo->ContextRecord->R13,
                &exInfo->ContextRecord->R14, &exInfo->ContextRecord->R15,
            };
            if (regField >= 0 && regField < 16 && regField != 4) { // Don't zero RSP!
                // Point to dummy page instead of zeroing — prevents cascading WRITE AVs
                DWORD64 safeValue = g_dummyPage ? (DWORD64)g_dummyPage : 0;
                *regMap[regField] = safeValue;
                fprintf(stderr, "[WavLoom] Set register %d to dummy page 0x%llX\n",
                        regField, (unsigned long long)safeValue);
            }
        }
    }
    // For WRITE AVs (including VEX stores): just NOP and skip.
    // The store silently doesn't happen. NOP patches are permanent so after one pass
    // through a function with sequential stores, all future calls are clean.

    // Patch the instruction with NOPs for future calls
    DWORD oldProtect = 0;
    if (VirtualProtect(ip, instrLen, PAGE_EXECUTE_READWRITE, &oldProtect)) {
        for (int i = 0; i < instrLen; i++) ip[i] = 0x90;
        VirtualProtect(ip, instrLen, oldProtect, &oldProtect);
        FlushInstructionCache(GetCurrentProcess(), ip, instrLen);
        fprintf(stderr, "[WavLoom] NOPed %d bytes — instruction patched\n", instrLen);
        fflush(stderr);
    }

    // Skip past the instruction in the current context
    exInfo->ContextRecord->Rip += instrLen;
    return true;
#else
    return false;
#endif
}

// Unwind the stack through ALL .vst3 module frames, stopping at the first non-plugin frame.
// This breaks out of internal plugin call chains.
// Returns true if recovery was attempted, false if unwinding failed.
static bool UnwindPastPluginCode(EXCEPTION_POINTERS* exInfo) {
#ifdef _M_X64
    CONTEXT ctx = *exInfo->ContextRecord;
    DWORD64 imageBase = 0;
    int framesUnwound = 0;

    for (int i = 0; i < 64; i++) {
        UNWIND_HISTORY_TABLE histTable = {};
        PRUNTIME_FUNCTION rtFunc = RtlLookupFunctionEntry(ctx.Rip, &imageBase, &histTable);
        if (!rtFunc) {
            if (i == 0) {
                ctx.Rip = *((DWORD64*)ctx.Rsp);
                ctx.Rsp += 8;
            } else {
                break;
            }
        } else {
            void* handlerData = nullptr;
            ULONG64 establisherFrame = 0;
            RtlVirtualUnwind(UNW_FLAG_NHANDLER, imageBase, ctx.Rip, rtFunc,
                              &ctx, &handlerData, &establisherFrame, nullptr);
        }
        framesUnwound++;

        if (!IsAddressInVST3Module((void*)ctx.Rip)) {
            fprintf(stderr, "[WavLoom] Unwound %d frames past plugin code — resuming at 0x%llX\n",
                    framesUnwound, (unsigned long long)ctx.Rip);
            fflush(stderr);

            exInfo->ContextRecord->Rip = ctx.Rip;
            exInfo->ContextRecord->Rsp = ctx.Rsp;
            exInfo->ContextRecord->Rbp = ctx.Rbp;
            exInfo->ContextRecord->Rbx = ctx.Rbx;
            exInfo->ContextRecord->Rsi = ctx.Rsi;
            exInfo->ContextRecord->Rdi = ctx.Rdi;
            exInfo->ContextRecord->R12 = ctx.R12;
            exInfo->ContextRecord->R13 = ctx.R13;
            exInfo->ContextRecord->R14 = ctx.R14;
            exInfo->ContextRecord->R15 = ctx.R15;
            exInfo->ContextRecord->Rax = 0;
            return true;
        }
    }

    // Fallback: simple single-frame return
    fprintf(stderr, "[WavLoom] Could not unwind past plugin code (%d frames) — single frame fallback\n",
            framesUnwound);
    fflush(stderr);
    DWORD64 returnAddr = *((DWORD64*)exInfo->ContextRecord->Rsp);
    exInfo->ContextRecord->Rip = returnAddr;
    exInfo->ContextRecord->Rsp += 8;
    exInfo->ContextRecord->Rax = 0;
    return true;
#elif defined(_M_IX86)
    DWORD returnAddr = *((DWORD*)exInfo->ContextRecord->Esp);
    exInfo->ContextRecord->Eip = returnAddr;
    exInfo->ContextRecord->Esp += 4;
    exInfo->ContextRecord->Eax = 0;
    return true;
#else
    return false;
#endif
}

// Decode the instruction at 'ip' to find the x64 register index (0=RAX..15=R15)
// used as the memory base operand, or -1 if unable to decode.
// Handles legacy, VEX (C4/C5), and EVEX (62) encodings.
static int GetBaseRegisterIndex(const BYTE* ip) {
    const BYTE* p = ip;
    bool rexB = false;

    if (*p == 0xC5) {
        // 2-byte VEX: C5 [vex_byte] [opcode] [modrm]
        // 2-byte VEX always has B=0 (no REX.B extension available)
        rexB = false;
        p += 2; // skip C5 + vex byte
        p++;     // skip opcode
    } else if (*p == 0xC4) {
        // 3-byte VEX: C4 [byte1] [byte2] [opcode] [modrm]
        // B is bit 5 of byte1 (inverted)
        rexB = !(p[1] & 0x20);
        p += 3;
        p++;     // skip opcode
    } else if (*p == 0x62) {
        // EVEX: 62 [byte1] [byte2] [byte3] [opcode] [modrm]
        rexB = !(p[1] & 0x20);
        p += 4;
        p++;     // skip opcode
    } else {
        // Legacy: skip prefixes, REX, opcode
        while (*p == 0x66 || *p == 0x67 || *p == 0xF2 || *p == 0xF3 ||
               *p == 0x26 || *p == 0x2E || *p == 0x36 || *p == 0x3E ||
               *p == 0x64 || *p == 0x65) p++;
        if (*p >= 0x40 && *p <= 0x4F) {
            rexB = (*p & 0x01) != 0;
            p++;
        }
        BYTE opcode = *p++;
        if (opcode == 0x0F) p++; // two-byte opcode, skip second byte
    }

    // p now points to ModRM byte
    BYTE modrm = *p;
    BYTE mod = (modrm >> 6) & 3;
    BYTE rm = modrm & 7;

    if (mod == 3) return -1; // register-to-register, no memory operand

    if (rm == 4) {
        // SIB byte follows
        BYTE sib = *(p + 1);
        BYTE base = sib & 7;
        if (base == 5 && mod == 0) return -1; // [disp32 + index*scale], no base reg
        return base | (rexB ? 8 : 0);
    }
    if (rm == 5 && mod == 0) return -1; // [RIP+disp32]

    return rm | (rexB ? 8 : 0);
}

// Redirect the faulting register to the dummy page so the instruction re-executes safely.
// READ AVs: register holding invalid address → dummy page (reads zeros).
// WRITE AVs: decode instruction to find the ACTUAL base register and redirect only that one.
//   (Blind scanning by small values redirects wrong registers and corrupts plugin state.)
static bool RedirectFaultingRegister(PCONTEXT ctx, ULONG_PTR faultAddr, ULONG_PTR avType, LONG count) {
    if (!g_dummyPage) return false;

    DWORD64 dummyBase = (DWORD64)g_dummyPage;

    // Full x64 register map indexed by encoding (0=RAX..15=R15)
    DWORD64* regMap[] = {
        &ctx->Rax, &ctx->Rcx, &ctx->Rdx, &ctx->Rbx,
        &ctx->Rsp, &ctx->Rbp, &ctx->Rsi, &ctx->Rdi,
        &ctx->R8,  &ctx->R9,  &ctx->R10, &ctx->R11,
        &ctx->R12, &ctx->R13, &ctx->R14, &ctx->R15,
    };
    static const char* regNames16[] = {
        "RAX","RCX","RDX","RBX","RSP","RBP","RSI","RDI",
        "R8","R9","R10","R11","R12","R13","R14","R15"
    };

    if (avType == 0) {
        // READ AV: first try exact match (fast, unambiguous when it works)
        for (int i = 0; i < 16; i++) {
            if (i == 4 || i == 5) continue; // skip RSP, RBP
            if (*regMap[i] == (DWORD64)faultAddr) {
                DWORD64 old = *regMap[i];
                *regMap[i] = dummyBase;
                if (count <= 20) {
                    fprintf(stderr, "[WavLoom] Redirect %s: 0x%llX -> dummy (READ exact)\n",
                            regNames16[i], (unsigned long long)old);
                    fflush(stderr);
                }
                return true;
            }
        }
        // Exact match failed (e.g. faultAddr=0xFFFFFFFFFFFFFFFF) → decode instruction
        // to find the base register. This prevents instruction-skip which corrupts the stack.
        int baseIdx = GetBaseRegisterIndex((const BYTE*)ctx->Rip);
        if (baseIdx >= 0 && baseIdx < 16 && baseIdx != 4 && baseIdx != 5) {
            DWORD64 old = *regMap[baseIdx];
            *regMap[baseIdx] = dummyBase;
            if (count <= 20) {
                fprintf(stderr, "[WavLoom] Redirect %s: 0x%llX -> dummy (READ decoded base)\n",
                        regNames16[baseIdx], (unsigned long long)old);
                fflush(stderr);
            }
            return true;
        }
    } else if (avType == 1) {
        // WRITE AV: decode instruction to find the actual base register.
        // CRITICAL: we must NOT blindly scan all registers for small values — that
        // redirects wrong registers (e.g. R8, R12, RBX) and corrupts plugin state,
        // causing the FATAL ERROR: napi_get_last_error_info.
        int baseIdx = GetBaseRegisterIndex((const BYTE*)ctx->Rip);
        if (baseIdx >= 0 && baseIdx < 16 && baseIdx != 4 && baseIdx != 5) {
            DWORD64 old = *regMap[baseIdx];
            *regMap[baseIdx] = dummyBase;
            if (count <= 20) {
                fprintf(stderr, "[WavLoom] Redirect %s: 0x%llX -> dummy (WRITE decoded base)\n",
                        regNames16[baseIdx], (unsigned long long)old);
                fflush(stderr);
            }
            return true;
        }
        // Decode failed — last resort: scan for register matching faultAddr
        // (only exact match, not small-value heuristic)
        for (int i = 0; i < 16; i++) {
            if (i == 4 || i == 5) continue;
            DWORD64 rv = *regMap[i];
            if (rv == (DWORD64)faultAddr) {
                *regMap[i] = dummyBase;
                if (count <= 20) {
                    fprintf(stderr, "[WavLoom] Redirect %s: 0x%llX -> dummy (WRITE exact match)\n",
                            regNames16[i], (unsigned long long)rv);
                    fflush(stderr);
                }
                return true;
            }
        }
    }

    return false;
}

static LONG WINAPI PluginCrashGuardVEH(EXCEPTION_POINTERS* exInfo) {
    if (!exInfo || !exInfo->ExceptionRecord) return EXCEPTION_CONTINUE_SEARCH;

    DWORD exCode = exInfo->ExceptionRecord->ExceptionCode;
    DWORD threadId = GetCurrentThreadId();

    // Skip very common harmless exceptions
    if (exCode == 0x40010006 || exCode == 0x406D1388) {
        return EXCEPTION_CONTINUE_SEARCH;
    }

    // Log non-trivial exceptions (suppress recurring main-thread .vst3 AVs after first 20)
    if (threadId != g_mainThreadId) {
        fprintf(stderr, "[WavLoom-VEH] Thread %lu: ex=0x%08lX flags=0x%lX addr=0x%llX\n",
                threadId, exCode, exInfo->ExceptionRecord->ExceptionFlags,
                (unsigned long long)(DWORD64)exInfo->ExceptionRecord->ExceptionAddress);
        fflush(stderr);
    }

    // --- Main thread: PURE register redirect (NO NOP-patching) ---
    // NOP-patching corrupts function state: when a MOV is NOPed, the destination register
    // keeps its stale value, which downstream code writes to the stack, corrupting N-API state.
    // Instead, we redirect the faulting register to a dummy page every time.
    // The same ~18 instructions crash on each processBlock call — that's fine, each redirect
    // takes <1μs and there's no state corruption.
    // We MUST return CONTINUE_EXECUTION because V8's own VEH intercepts AVs before SEH.
    if (threadId == g_mainThreadId) {
        if (exCode == EXCEPTION_ACCESS_VIOLATION && exInfo->ExceptionRecord->NumberParameters >= 2) {
            void* crashAddr = exInfo->ExceptionRecord->ExceptionAddress;
            if (IsAddressInVST3Module(crashAddr)) {
                LONG count = InterlockedIncrement(&g_mainThreadRecoveryCount);

                ULONG_PTR avType = exInfo->ExceptionRecord->ExceptionInformation[0];
                ULONG_PTR faultAddr = exInfo->ExceptionRecord->ExceptionInformation[1];

                // Log first 20 for diagnostics, suppress after that
                if (count <= 20) {
                    fprintf(stderr, "[WavLoom] Plugin AV #%ld at 0x%llX (type=%s target=0x%llX)\n",
                            count,
                            (unsigned long long)(DWORD64)crashAddr,
                            avType == 0 ? "READ" : avType == 1 ? "WRITE" : "DEP",
                            (unsigned long long)faultAddr);
                    BYTE* ip = (BYTE*)crashAddr;
                    fprintf(stderr, "[WavLoom]   Bytes: %02X %02X %02X %02X %02X %02X %02X %02X\n",
                            ip[0], ip[1], ip[2], ip[3], ip[4], ip[5], ip[6], ip[7]);
                    fflush(stderr);
                } else if (count == 21) {
                    fprintf(stderr, "[WavLoom] Suppressing further AV logs (redirecting silently)...\n");
                    fflush(stderr);
                }

#ifdef _M_X64
                // Try register redirection — preserves full instruction flow
                if (RedirectFaultingRegister(exInfo->ContextRecord, faultAddr, avType, count)) {
                    return EXCEPTION_CONTINUE_EXECUTION;
                }

                // Redirect failed (couldn't identify faulting register) → skip instruction
                BYTE* ip = (BYTE*)crashAddr;
                int instrLen = GetX64InstructionLength(ip);
                if (instrLen >= 1 && instrLen <= 15) {
                    if (count <= 20) {
                        fprintf(stderr, "[WavLoom] Skip %d-byte instruction at 0x%llX (redirect failed)\n",
                                instrLen, (unsigned long long)(DWORD64)ip);
                        fflush(stderr);
                    }
                    exInfo->ContextRecord->Rip += instrLen;
                    return EXCEPTION_CONTINUE_EXECUTION;
                }
#endif
            }
        }

        // Non-.vst3 or unhandled → pass to other handlers
        return EXCEPTION_CONTINUE_SEARCH;
    }

    // Skip debug/informational/COM exceptions on background threads
    if (exCode == 0x40010006 ||    // OutputDebugString
        exCode == 0x406D1388 ||    // Thread naming exception
        exCode == 0x80000003 ||    // EXCEPTION_BREAKPOINT
        exCode == 0x80000004 ||    // EXCEPTION_SINGLE_STEP
        exCode == 0x000006BA ||    // RPC_S_SERVER_UNAVAILABLE (normal COM)
        exCode == 0x80010108 ||    // RPC_E_DISCONNECTED (normal COM)
        exCode == 0x800706BA ||    // HRESULT RPC server unavailable
        exCode == 0x80010002 ||    // RPC_E_CALL_CANCELED
        exCode == 0x8001010D ||    // RPC_E_SERVER_DIED
        (exCode & 0xF0000000) == 0x40000000) {  // Informational status codes
        return EXCEPTION_CONTINUE_SEARCH;
    }

    // ONLY intercept background thread crashes if they originate from a .vst3 module.
    // System/COM/framework exceptions should not be intercepted — they have their own handlers.
    void* bgCrashAddr = exInfo->ExceptionRecord->ExceptionAddress;
    if (!IsAddressInVST3Module(bgCrashAddr)) {
        return EXCEPTION_CONTINUE_SEARCH;
    }

    // Intercept fatal exceptions from plugin background threads.
    bool shouldIntercept = (exCode == EXCEPTION_ACCESS_VIOLATION ||   // 0xC0000005
                            exCode == EXCEPTION_STACK_OVERFLOW ||     // 0xC00000FD
                            exCode == EXCEPTION_ILLEGAL_INSTRUCTION ||// 0xC000001D
                            exCode == EXCEPTION_INT_DIVIDE_BY_ZERO || // 0xC0000094
                            exCode == EXCEPTION_FLT_DIVIDE_BY_ZERO || // 0xC000008E
                            exCode == 0xE06D7363 ||                   // MSVC C++ exception
                            exCode == 0xC0000374 ||                   // STATUS_HEAP_CORRUPTION
                            exCode == 0xC0000409 ||                   // STATUS_STACK_BUFFER_OVERRUN (__fastfail)
                            exCode == 0xC0000602);                    // STATUS_FAIL_FAST_EXCEPTION
    if (!shouldIntercept) {
        return EXCEPTION_CONTINUE_SEARCH;
    }

    fprintf(stderr, "[WavLoom] Plugin thread %lu: intercepting 0x%08lX at .vst3 addr 0x%llX — redirecting to ExitThread\n",
            threadId, exCode, (unsigned long long)(DWORD64)bgCrashAddr);
    fflush(stderr);

    // Redirect the crashing thread to ExitThread(exCode) by modifying its context.
    // This kills only the offending thread, keeping the host process alive.
    void* exitThreadAddr = (void*)&ExitThread;
#ifdef _M_X64
    exInfo->ContextRecord->Rip = (DWORD64)exitThreadAddr;
    exInfo->ContextRecord->Rcx = (DWORD64)exCode;
    // Align stack for x64 ABI (16-byte aligned with 8-byte return address slot)
    exInfo->ContextRecord->Rsp = (exInfo->ContextRecord->Rsp & ~0xFULL) - 8;
#elif defined(_M_IX86)
    exInfo->ContextRecord->Eip = (DWORD)exitThreadAddr;
    exInfo->ContextRecord->Esp -= 8;
    DWORD* stack = (DWORD*)exInfo->ContextRecord->Esp;
    stack[0] = 0;       // Fake return address (ExitThread never returns)
    stack[1] = exCode;  // dwExitCode parameter
#endif
    return EXCEPTION_CONTINUE_EXECUTION;
}

// std::terminate handler — catches uncaught C++ exceptions from any thread
static void PluginTerminateHandler() {
    DWORD threadId = GetCurrentThreadId();
    fprintf(stderr, "[WavLoom] std::terminate on thread %lu\n", threadId);
    fflush(stderr);
    if (threadId != g_mainThreadId) {
        ExitThread(1); // Kill just this thread
    }
    std::abort(); // Main thread — let it crash normally
}

// Handle abort() from plugin background threads
static void PluginAbortHandler(int) {
    DWORD threadId = GetCurrentThreadId();
    fprintf(stderr, "[WavLoom] abort() on thread %lu (main=%lu)\n", threadId, g_mainThreadId);
    fflush(stderr);
    if (threadId != g_mainThreadId) {
        signal(SIGABRT, PluginAbortHandler); // Re-install (signal resets to SIG_DFL)
        ExitThread(1);
    }
    // Main thread abort: restore default and re-raise
    signal(SIGABRT, SIG_DFL);
    raise(SIGABRT);
}

// atexit handler for diagnostics
static void PluginAtExitHandler() {
    fprintf(stderr, "[WavLoom] atexit handler called on thread %lu\n", GetCurrentThreadId());
    fflush(stderr);
}

static void InstallPluginCrashGuard() {
    g_mainThreadId = GetCurrentThreadId();
    // Allocate a dummy page for READ AV recovery (prevents cascading WRITE AVs)
    g_dummyPage = VirtualAlloc(nullptr, DUMMY_PAGE_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (g_dummyPage) {
        memset(g_dummyPage, 0, DUMMY_PAGE_SIZE);
    }
    // VEH with first=TRUE: called before all other exception handlers, cannot be overridden
    AddVectoredExceptionHandler(TRUE, PluginCrashGuardVEH);
    // Also install as unhandled exception filter (backup in case VEH doesn't catch)
    SetUnhandledExceptionFilter(PluginCrashGuardVEH);
    signal(SIGABRT, PluginAbortHandler);
    _set_abort_behavior(0, _WRITE_ABORT_MSG | _CALL_REPORTFAULT);
    std::set_terminate(PluginTerminateHandler);
    atexit(PluginAtExitHandler);
    fprintf(stderr, "[WavLoom] Plugin crash guard installed (main thread=%lu)\n", g_mainThreadId);
    fflush(stderr);
}
#endif // _WIN32

static Napi::Value GetAddonVersion(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), "1.0.0");
}

static Napi::Value IsAddonAvailable(const Napi::CallbackInfo& info) {
#ifdef VST3_SDK_AVAILABLE
    return Napi::Boolean::New(info.Env(), true);
#else
    return Napi::Boolean::New(info.Env(), false);
#endif
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#ifdef _WIN32
    InstallPluginCrashGuard();
#endif

    // Always available
    exports.Set("getVersion", Napi::Function::New(env, GetAddonVersion));
    exports.Set("isAvailable", Napi::Function::New(env, IsAddonAvailable));

#ifdef VST3_SDK_AVAILABLE
    // Full VST3 host API
    exports.Set("loadPlugin", Napi::Function::New(env, wavloom_napi::LoadPlugin));
    exports.Set("unloadPlugin", Napi::Function::New(env, wavloom_napi::UnloadPlugin));
    exports.Set("unloadAll", Napi::Function::New(env, wavloom_napi::UnloadAll));
    exports.Set("processBlock", Napi::Function::New(env, wavloom_napi::ProcessBlock));
    exports.Set("sendNoteOn", Napi::Function::New(env, wavloom_napi::SendNoteOn));
    exports.Set("sendNoteOff", Napi::Function::New(env, wavloom_napi::SendNoteOff));
    exports.Set("sendCC", Napi::Function::New(env, wavloom_napi::SendCC));
    exports.Set("setParameter", Napi::Function::New(env, wavloom_napi::SetParameter));
    exports.Set("getParameter", Napi::Function::New(env, wavloom_napi::GetParameter));
    exports.Set("getParameterList", Napi::Function::New(env, wavloom_napi::GetParameterList));
    exports.Set("setTransportState", Napi::Function::New(env, wavloom_napi::SetTransportState));
    exports.Set("setSampleRate", Napi::Function::New(env, wavloom_napi::SetSampleRate));
    exports.Set("setBlockSize", Napi::Function::New(env, wavloom_napi::SetBlockSize));
    exports.Set("getPluginState", Napi::Function::New(env, wavloom_napi::GetPluginState));
    exports.Set("setPluginState", Napi::Function::New(env, wavloom_napi::SetPluginState));

    // Editor (plugin GUI window)
    exports.Set("openEditor", Napi::Function::New(env, wavloom_napi::OpenEditor));
    exports.Set("closeEditor", Napi::Function::New(env, wavloom_napi::CloseEditor));
    exports.Set("isEditorOpen", Napi::Function::New(env, wavloom_napi::IsEditorOpen));

    // Editor key callback (spacebar passthrough from VST3 editor to host)
    exports.Set("registerEditorKeyCallback", Napi::Function::New(env, wavloom_napi::RegisterEditorKeyCallback));
#endif

    return exports;
}

NODE_API_MODULE(wavloom_vst3_host, Init)
