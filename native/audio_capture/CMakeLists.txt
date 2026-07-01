cmake_minimum_required(VERSION 3.15)
project(freally_audio_capture)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Use dynamic CRT (/MD) for consistency with other Freally native addons
if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL" CACHE STRING "" FORCE)
endif()

# cmake-js variables (injected by cmake-js at build time)
include_directories(${CMAKE_JS_INC})

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

# Source files
set(SOURCES
    src/napi_bindings.cpp
    src/audio_capture.cpp
)

# Build as shared library (.node)
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Link libraries
target_link_libraries(${PROJECT_NAME}
    ${CMAKE_JS_LIB}
)

# Windows WASAPI / COM libraries
if(WIN32)
    target_link_libraries(${PROJECT_NAME} ole32 uuid avrt)
endif()
