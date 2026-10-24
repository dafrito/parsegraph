cmake_minimum_required(VERSION 3.18)
foreach(required PACKAGE_SOURCE TEST_ROOT C_COMPILER CXX_COMPILER)
  if(NOT DEFINED ${required} OR "${${required}}" STREQUAL "")
    message(FATAL_ERROR "Missing ${required}")
  endif()
endforeach()
if(NOT TEST_CONFIG)
  set(TEST_CONFIG Release)
endif()
# Normalize archive entry times and Apple's ranlib index timestamps. These
# settings apply to producer builds as well as CPack's install/reindex step.
set(ENV{SOURCE_DATE_EPOCH} 1700000000)
set(ENV{ZERO_AR_DATE} 1)

function(run)
  execute_process(COMMAND ${ARGV} RESULT_VARIABLE result)
  if(NOT result EQUAL 0)
    message(FATAL_ERROR "Command failed (${result}): ${ARGV}")
  endif()
endfunction()

# A deliberately minimal source snapshot: no Node dependencies, tests, Qt or
# benchmark sources. Delete it and its build before compiling consumers.
file(REMOVE_RECURSE "${TEST_ROOT}")
set(source "${TEST_ROOT}/source snapshot/native")
set(build "${TEST_ROOT}/producer build")
set(original "${TEST_ROOT}/original prefix")
set(relocated "${TEST_ROOT}/relocated prefix")
file(MAKE_DIRECTORY "${source}")
file(COPY "${PACKAGE_SOURCE}/CMakeLists.txt" "${PACKAGE_SOURCE}/README.md"
  "${PACKAGE_SOURCE}/src" "${PACKAGE_SOURCE}/include" "${PACKAGE_SOURCE}/cmake"
  DESTINATION "${source}")
file(COPY "${PACKAGE_SOURCE}/../LICENSE" DESTINATION "${TEST_ROOT}/source snapshot")
file(COPY "${PACKAGE_SOURCE}/examples/installed/" DESTINATION "${TEST_ROOT}/consumer")
set(libdir lib)
set(includedir include)
if(CUSTOM_DIRS)
  set(libdir lib/custom)
  set(includedir headers)
endif()
if(NOT CUSTOM_DIRS)
  # Reject non-relocatable configuration before packaging anything.
  execute_process(COMMAND "${CMAKE_COMMAND}" -S "${source}"
    -B "${TEST_ROOT}/invalid install dirs" "-DCMAKE_C_COMPILER=${C_COMPILER}"
    -DBUILD_TESTING=OFF -DPARSEGRAPH_BUILD_EXAMPLES=OFF
    -DPARSEGRAPH_BUILD_BENCHMARKS=OFF "-DCMAKE_INSTALL_LIBDIR=${TEST_ROOT}/absolute lib"
    RESULT_VARIABLE invalid_dirs OUTPUT_VARIABLE output ERROR_VARIABLE error)
  if(invalid_dirs EQUAL 0 OR NOT "${output}${error}" MATCHES "must be relative")
    message(FATAL_ERROR "Expected absolute install directory rejection: ${output}${error}")
  endif()
  run("${CMAKE_COMMAND}" -S "${source}" -B "${TEST_ROOT}/sanitized build"
    "-DCMAKE_C_COMPILER=${C_COMPILER}" -DBUILD_TESTING=OFF
    -DPARSEGRAPH_BUILD_EXAMPLES=OFF -DPARSEGRAPH_BUILD_BENCHMARKS=OFF
    -DPARSEGRAPH_SANITIZE=ON)
  execute_process(COMMAND "${CMAKE_COMMAND}" --install "${TEST_ROOT}/sanitized build"
    --prefix "${TEST_ROOT}/rejected install"
    RESULT_VARIABLE sanitized OUTPUT_VARIABLE output ERROR_VARIABLE error)
  if(sanitized EQUAL 0 OR NOT "${output}${error}" MATCHES "Install requires PARSEGRAPH_SANITIZE=OFF")
    message(FATAL_ERROR "Expected sanitized install rejection: ${output}${error}")
  endif()
  if(EXISTS "${TEST_ROOT}/rejected install")
    message(FATAL_ERROR "Rejected installation must not write files")
  endif()
endif()
run("${CMAKE_COMMAND}" -S "${source}" -B "${build}"
  "-DCMAKE_C_COMPILER=${C_COMPILER}" "-DCMAKE_BUILD_TYPE=${TEST_CONFIG}"
  "-DCMAKE_INSTALL_PREFIX=${TEST_ROOT}/unused configured prefix"
  "-DCMAKE_INSTALL_LIBDIR=${libdir}" "-DCMAKE_INSTALL_INCLUDEDIR=${includedir}"
  -DBUILD_TESTING=OFF -DPARSEGRAPH_SANITIZE=OFF -DPARSEGRAPH_TS_PARITY=OFF
  -DPARSEGRAPH_BUILD_EXAMPLES=OFF -DPARSEGRAPH_BUILD_BENCHMARKS=OFF
  -DPARSEGRAPH_BUILD_QT_VIEWER=OFF)
run("${CMAKE_COMMAND}" --build "${build}" --config "${TEST_CONFIG}" --parallel 2)
run("${CMAKE_COMMAND}" --install "${build}" --config "${TEST_CONFIG}" --prefix "${original}")
file(RENAME "${original}" "${relocated}")

# Exercise the archive too, not just --install's directory tree.
run("${CMAKE_COMMAND}" --build "${build}" --config "${TEST_CONFIG}" --target package)
file(GLOB archives "${build}/parsegraph-native-*.tar.gz")
list(LENGTH archives archive_count)
if(NOT archive_count EQUAL 1)
  message(FATAL_ERROR "Expected one native archive: ${archives}")
endif()
file(SHA256 "${archives}" first_digest)
run("${CMAKE_COMMAND}" --build "${build}" --config "${TEST_CONFIG}" --target package)
file(SHA256 "${archives}" second_digest)
if(NOT first_digest STREQUAL second_digest)
  message(FATAL_ERROR "Repeated packaging changed the archive checksum")
endif()
file(MAKE_DIRECTORY "${TEST_ROOT}/unpacked")
execute_process(COMMAND "${CMAKE_COMMAND}" -E tar xzf ${archives}
  WORKING_DIRECTORY "${TEST_ROOT}/unpacked" RESULT_VARIABLE result)
if(NOT result EQUAL 0)
  message(FATAL_ERROR "Cannot unpack native archive")
endif()
file(GLOB archive_prefix LIST_DIRECTORIES true "${TEST_ROOT}/unpacked/*")
list(LENGTH archive_prefix prefix_count)
if(NOT prefix_count EQUAL 1)
  message(FATAL_ERROR "Expected one archive prefix: ${archive_prefix}")
endif()
file(REMOVE_RECURSE "${TEST_ROOT}/source snapshot" "${build}")
file(REMOVE_RECURSE "${TEST_ROOT}/sanitized build" "${TEST_ROOT}/invalid install dirs")

set(index 0)
foreach(prefix "${relocated}" "${archive_prefix}")
  math(EXPR index "${index} + 1")
  foreach(required "share/parsegraph/LICENSE" "${includedir}/parsegraph/caret.h"
      "${libdir}/cmake/parsegraph/parsegraphConfigVersion.cmake")
    if(NOT EXISTS "${prefix}/${required}")
      message(FATAL_ERROR "Package is missing ${required}")
    endif()
  endforeach()
  file(GLOB_RECURSE exports "${prefix}/*.cmake")
  foreach(export IN LISTS exports)
    file(READ "${export}" text)
    foreach(forbidden "${PACKAGE_SOURCE}" "${source}" "${build}" "${original}"
        extent_options -Werror -fsanitize -ffp-contract)
      string(FIND "${text}" "${forbidden}" found)
      if(NOT found EQUAL -1)
        message(FATAL_ERROR "Nonportable export ${export}: ${forbidden}")
      endif()
    endforeach()
  endforeach()
  set(config_dir "${prefix}/${libdir}/cmake/parsegraph")
  # Default directories must support ordinary CMAKE_PREFIX_PATH discovery.
  set(find_options "-DCMAKE_PREFIX_PATH=${prefix}")
  if(CUSTOM_DIRS)
    list(APPEND find_options "-Dparsegraph_DIR=${config_dir}")
  endif()
  run("${CMAKE_COMMAND}" -S "${TEST_ROOT}/consumer" -B "${TEST_ROOT}/consumer-${index}"
    "-DCMAKE_C_COMPILER=${C_COMPILER}" "-DCMAKE_CXX_COMPILER=${CXX_COMPILER}"
    "-DCMAKE_BUILD_TYPE=${TEST_CONFIG}" "-DEXPECTED_PREFIX=${prefix}"
    -DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF -DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF
    ${find_options})
  run("${CMAKE_COMMAND}" --build "${TEST_ROOT}/consumer-${index}" --config "${TEST_CONFIG}" --parallel 2)
  run("${CMAKE_CTEST_COMMAND}" --test-dir "${TEST_ROOT}/consumer-${index}"
    -C "${TEST_CONFIG}" --output-on-failure)

  # Compatibility is confined to this native minor version, not npm's major.
  file(MAKE_DIRECTORY "${TEST_ROOT}/version-check")
  file(WRITE "${TEST_ROOT}/version-check/CMakeLists.txt"
    "cmake_minimum_required(VERSION 3.18)\nproject(version_check LANGUAGES C)\nfind_package(parsegraph 0.2 CONFIG REQUIRED PATHS \"${config_dir}\" NO_DEFAULT_PATH)\n")
  execute_process(COMMAND "${CMAKE_COMMAND}" -S "${TEST_ROOT}/version-check"
    -B "${TEST_ROOT}/version-${index}" "-DCMAKE_C_COMPILER=${C_COMPILER}"
    RESULT_VARIABLE incompatible OUTPUT_VARIABLE output ERROR_VARIABLE error)
  if(incompatible EQUAL 0 OR NOT "${output}${error}" MATCHES "not compatible")
    message(FATAL_ERROR "Expected incompatible native version rejection: ${output}${error}")
  endif()
endforeach()
