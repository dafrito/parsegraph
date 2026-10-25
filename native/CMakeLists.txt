cmake_minimum_required(VERSION 3.18)
project(parsegraph VERSION 0.1.0 LANGUAGES C)

option(PARSEGRAPH_SANITIZE "Enable address and undefined-behavior sanitizers" OFF)
option(PARSEGRAPH_TS_PARITY "Run parity checks against this checkout's TypeScript" ON)
option(PARSEGRAPH_BUILD_EXAMPLES "Build the standalone SVG example" ON)
option(PARSEGRAPH_BUILD_BENCHMARKS "Build deterministic native benchmarks" ON)
option(PARSEGRAPH_BUILD_QT_VIEWER "Build the Qt Quick reference viewer (Qt 6.7+)" OFF)
include(CTest)
include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

# Build policy stays in this directory, never in exported usage requirements.
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)
if(CMAKE_C_COMPILER_ID MATCHES "Clang|GNU")
  add_compile_options(-Wall -Wextra -Wpedantic -Werror -ffp-contract=off)
  if(PARSEGRAPH_SANITIZE)
    add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
    add_link_options(-fsanitize=address,undefined)
  endif()
endif()

add_library(parsegraph_extent STATIC src/extent.c)
target_include_directories(parsegraph_extent PUBLIC
  "$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>"
  "$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>")
target_compile_features(parsegraph_extent PUBLIC c_std_11)
if(NOT WIN32)
  target_link_libraries(parsegraph_extent PUBLIC m)
endif()
set_target_properties(parsegraph_extent PROPERTIES EXPORT_NAME extent
  POSITION_INDEPENDENT_CODE ON)
add_library(parsegraph::extent ALIAS parsegraph_extent)

add_library(parsegraph STATIC src/types.c src/node.c src/layout.c src/caret.c src/paint.c)
target_link_libraries(parsegraph PUBLIC parsegraph_extent)
set_target_properties(parsegraph PROPERTIES POSITION_INDEPENDENT_CODE ON)
add_library(parsegraph::parsegraph ALIAS parsegraph)

# Sanitized archives require matching runtime flags and are not distributable.
if(PARSEGRAPH_SANITIZE)
  install(CODE "message(FATAL_ERROR \"Install requires PARSEGRAPH_SANITIZE=OFF; use a separate package build.\")")
else()
  include(cmake/Packaging.cmake)
endif()
if(PARSEGRAPH_BUILD_EXAMPLES OR PARSEGRAPH_BUILD_BENCHMARKS OR PARSEGRAPH_BUILD_QT_VIEWER OR BUILD_TESTING)
  add_library(parsegraph_primes STATIC examples/primes.c)
  target_include_directories(parsegraph_primes PUBLIC examples)
  target_link_libraries(parsegraph_primes PUBLIC parsegraph)
  set_target_properties(parsegraph_primes PROPERTIES C_EXTENSIONS OFF)
endif()
if(PARSEGRAPH_BUILD_EXAMPLES)
  add_executable(parsegraph_svg examples/svg.c)
  target_link_libraries(parsegraph_svg PRIVATE parsegraph)
endif()
if(PARSEGRAPH_BUILD_BENCHMARKS)
  add_executable(parsegraph_matched_benchmark bench/matched.c)
  target_link_libraries(parsegraph_matched_benchmark PRIVATE parsegraph)
  add_executable(parsegraph_benchmark bench/benchmark.c)
  target_link_libraries(parsegraph_benchmark PRIVATE parsegraph)
  add_executable(parsegraph_primes_benchmark bench/primes_benchmark.c)
  target_link_libraries(parsegraph_primes_benchmark PRIVATE parsegraph_primes)
endif()

if(BUILD_TESTING)
  enable_language(CXX)
  add_executable(primes_test tests/primes_test.c)
  target_link_libraries(primes_test PRIVATE parsegraph_primes)
  add_test(NAME primes COMMAND primes_test)
  add_executable(graph_cpp_test tests/graph_consumer.cpp)
  target_compile_features(graph_cpp_test PRIVATE cxx_std_11)
  target_link_libraries(graph_cpp_test PRIVATE parsegraph)
  add_test(NAME graph_cpp_consumer COMMAND graph_cpp_test)
  foreach(component types node caret layout paint focus)
    add_executable(${component}_test tests/${component}_test.c)
    target_link_libraries(${component}_test PRIVATE parsegraph)
    add_test(NAME ${component} COMMAND ${component}_test)
  endforeach()
  add_executable(caret_allocation_test tests/caret_test.c)
  target_compile_definitions(caret_allocation_test PRIVATE PG_CARET_TEST_ALLOCATIONS)
  target_link_libraries(caret_allocation_test PRIVATE parsegraph)
  add_test(NAME caret_allocation_failure COMMAND caret_allocation_test)

  add_executable(layout_failure_test src/extent.c src/types.c src/node.c src/layout.c tests/layout_failure_test.c)
  target_compile_definitions(layout_failure_test PRIVATE malloc=pg_test_malloc calloc=pg_test_calloc realloc=pg_test_realloc free=pg_test_free)
  target_include_directories(layout_failure_test PRIVATE include)
  if(NOT WIN32)
    target_link_libraries(layout_failure_test PRIVATE m)
  endif()
  add_test(NAME layout_allocation_failure COMMAND layout_failure_test)
  add_executable(extent_test tests/extent_test.c)
  target_link_libraries(extent_test PRIVATE parsegraph_extent)
  add_test(NAME extent COMMAND extent_test)

  add_executable(extent_cpp_test tests/consumer.cpp)
  target_compile_features(extent_cpp_test PRIVATE cxx_std_11)
  target_link_libraries(extent_cpp_test PRIVATE parsegraph_extent)
  add_test(NAME cpp_consumer COMMAND extent_cpp_test)

  # Replace allocation only in this test build; the public library uses libc.
  add_executable(extent_failure_test src/extent.c tests/failure.c)
  target_compile_definitions(extent_failure_test PRIVATE malloc=pg_test_malloc free=pg_test_free)
  target_include_directories(extent_failure_test PRIVATE include)
  if(NOT WIN32)
    target_link_libraries(extent_failure_test PRIVATE m)
  endif()
  add_test(NAME allocation_failure COMMAND extent_failure_test)

  add_test(NAME installed_package COMMAND "${CMAKE_COMMAND}"
    "-DPACKAGE_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DTEST_ROOT=${CMAKE_CURRENT_BINARY_DIR}/package-acceptance"
    "-DC_COMPILER=${CMAKE_C_COMPILER}"
    "-DCXX_COMPILER=${CMAKE_CXX_COMPILER}"
    "-DTEST_CONFIG=$<CONFIG>"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/installed_package.cmake")
  set_tests_properties(installed_package PROPERTIES TIMEOUT 120 LABELS packaging)
  add_test(NAME installed_package_custom_dirs COMMAND "${CMAKE_COMMAND}"
    "-DPACKAGE_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DTEST_ROOT=${CMAKE_CURRENT_BINARY_DIR}/package-custom-acceptance"
    "-DC_COMPILER=${CMAKE_C_COMPILER}"
    "-DCXX_COMPILER=${CMAKE_CXX_COMPILER}"
    "-DTEST_CONFIG=$<CONFIG>" -DCUSTOM_DIRS=ON
    -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/installed_package.cmake")
  set_tests_properties(installed_package_custom_dirs PROPERTIES TIMEOUT 120 LABELS packaging)

  if(PARSEGRAPH_TS_PARITY)
    find_program(NODE_EXECUTABLE node REQUIRED)
    add_test(NAME focus_typescript_parity COMMAND "${NODE_EXECUTABLE}"
      "${CMAKE_CURRENT_SOURCE_DIR}/tests/focus_parity.cjs" "$<TARGET_FILE:focus_test>")
    set_tests_properties(focus_typescript_parity PROPERTIES TIMEOUT 60)
    add_executable(extent_probe tests/probe.c)
    target_link_libraries(extent_probe PRIVATE parsegraph_extent)
    add_test(NAME typescript_parity COMMAND "${NODE_EXECUTABLE}"
      "${CMAKE_CURRENT_SOURCE_DIR}/tests/parity.cjs" "$<TARGET_FILE:extent_probe>")
    set_tests_properties(typescript_parity PROPERTIES TIMEOUT 60)
    add_executable(graph_probe tests/graph_probe.c)
    target_link_libraries(graph_probe PRIVATE parsegraph)
    add_test(NAME graph_typescript_parity COMMAND "${NODE_EXECUTABLE}"
      "${CMAKE_CURRENT_SOURCE_DIR}/tests/graph_parity.cjs" "$<TARGET_FILE:graph_probe>")
    set_tests_properties(graph_typescript_parity PROPERTIES TIMEOUT 120)
    add_executable(primes_probe tests/primes_probe.c)
    target_link_libraries(primes_probe PRIVATE parsegraph_primes)
    add_test(NAME primes_typescript_parity COMMAND "${NODE_EXECUTABLE}"
      "${CMAKE_CURRENT_SOURCE_DIR}/tests/primes_parity.cjs" "$<TARGET_FILE:primes_probe>")
    set_tests_properties(primes_typescript_parity PROPERTIES TIMEOUT 120)
  endif()
  # Keep assertions (including their exercised API calls) active in Release.
  foreach(test_target types_test node_test caret_test layout_test paint_test focus_test
      caret_allocation_test layout_failure_test extent_test extent_cpp_test
      extent_failure_test graph_cpp_test primes_test)
    if(MSVC)
      target_compile_options(${test_target} PRIVATE /UNDEBUG)
    else()
      target_compile_options(${test_target} PRIVATE -UNDEBUG)
    endif()
  endforeach()
endif()

if(PARSEGRAPH_BUILD_QT_VIEWER)
  enable_language(CXX)
  add_subdirectory(qt-viewer)
endif()
