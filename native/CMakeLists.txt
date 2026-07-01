cmake_minimum_required(VERSION 3.15)
project(freally_vst3_host)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Use dynamic CRT (/MD) to match the VST3 SDK build — FORCE overrides cmake-js's default static /MT
if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL" CACHE STRING "" FORCE)
endif()

# cmake-js variables (injected by cmake-js at build time)
include_directories(${CMAKE_JS_INC})

# VST3 SDK — disable GUI, samples, validator (we only need hosting libs)
set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)

# Only add VST3 SDK if the submodule is present
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/third_party/vst3sdk/CMakeLists.txt")
    add_subdirectory(third_party/vst3sdk)
    set(VST3_SDK_FOUND TRUE)
else()
    message(WARNING "VST3 SDK not found. Building stub-only addon. Run: git submodule update --init --recursive")
    set(VST3_SDK_FOUND FALSE)
endif()

# node-addon-api headers
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
include_directories(${NODE_ADDON_API_DIR})

# N-API version and exception mode
add_definitions(-DNAPI_VERSION=8)
add_definitions(-DNAPI_DISABLE_CPP_EXCEPTIONS)

# SEH wrapping for plugin crash protection uses a C-style function (SEH_CallPlugin)
# that has no C++ objects, so /EHsc (default) is fine — no /EHa needed.

# Source files
if(VST3_SDK_FOUND)
    set(VST3_SDK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/vst3sdk")

    # Platform-specific Module::create implementation (not included in sdk_hosting lib)
    if(WIN32)
        set(MODULE_PLATFORM_SRC "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp")
    elseif(APPLE)
        set(MODULE_PLATFORM_SRC "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_mac.mm")
        # module_mac.mm is Objective-C++ and must be compiled with ARC enabled.
        set_source_files_properties("${MODULE_PLATFORM_SRC}" PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
    else()
        set(MODULE_PLATFORM_SRC "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_linux.cpp")
    endif()

    set(SOURCES
        src/napi_bindings.cpp
        src/napi_plugin_wrapper.cpp
        src/vst3_host.cpp
        src/plugin_instance.cpp
        src/audio_buffer.cpp
        ${MODULE_PLATFORM_SRC}
    )
    add_definitions(-DVST3_SDK_AVAILABLE)
else()
    # Stub mode: only napi_bindings with getVersion
    set(SOURCES
        src/napi_bindings.cpp
    )
endif()

# Build as shared library (.node)
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Link libraries
if(VST3_SDK_FOUND)
    target_link_libraries(${PROJECT_NAME}
        sdk
        sdk_hosting
        base
        pluginterfaces
        ${CMAKE_JS_LIB}
    )
else()
    target_link_libraries(${PROJECT_NAME}
        ${CMAKE_JS_LIB}
    )
endif()

# Platform-specific link libraries
if(WIN32)
    target_link_libraries(${PROJECT_NAME} ole32 oleaut32 uuid user32)
elseif(APPLE)
    find_library(COCOA_LIBRARY Cocoa)
    find_library(COREFOUNDATION_LIBRARY CoreFoundation)
    target_link_libraries(${PROJECT_NAME} ${COCOA_LIBRARY} ${COREFOUNDATION_LIBRARY})
endif()
