# Relative GNUInstallDirs keep both --prefix installs and archives relocatable.
foreach(directory CMAKE_INSTALL_LIBDIR CMAKE_INSTALL_INCLUDEDIR CMAKE_INSTALL_DATADIR)
  if(IS_ABSOLUTE "${${directory}}" OR "${${directory}}" MATCHES "(^|/)\\.\\.(/|$)")
    message(FATAL_ERROR "${directory} must be relative and remain inside the install prefix")
  endif()
endforeach()

set(parsegraph_config_dir "${CMAKE_INSTALL_LIBDIR}/cmake/parsegraph")
install(TARGETS parsegraph parsegraph_extent EXPORT parsegraphTargets
  ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}")
install(DIRECTORY include/parsegraph DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}"
  FILES_MATCHING PATTERN "*.h")
install(EXPORT parsegraphTargets FILE parsegraphTargets.cmake
  NAMESPACE parsegraph:: DESTINATION "${parsegraph_config_dir}")
configure_package_config_file(cmake/parsegraphConfig.cmake.in
  "${CMAKE_CURRENT_BINARY_DIR}/parsegraphConfig.cmake"
  INSTALL_DESTINATION "${parsegraph_config_dir}")
write_basic_package_version_file(
  "${CMAKE_CURRENT_BINARY_DIR}/parsegraphConfigVersion.cmake"
  VERSION "${PROJECT_VERSION}" COMPATIBILITY SameMinorVersion)
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/parsegraphConfig.cmake"
  "${CMAKE_CURRENT_BINARY_DIR}/parsegraphConfigVersion.cmake"
  DESTINATION "${parsegraph_config_dir}")
install(FILES "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE" README.md
  DESTINATION "${CMAKE_INSTALL_DATADIR}/parsegraph")

# Only the headless static library is packaged, not Qt or build dependencies.
set(CPACK_GENERATOR TGZ)
set(CPACK_PACKAGE_NAME parsegraph-native)
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_VENDOR "Rainback, Inc.")
set(CPACK_PACKAGE_FILE_NAME
  "parsegraph-native-${PROJECT_VERSION}-${CMAKE_SYSTEM_NAME}-${CMAKE_SYSTEM_PROCESSOR}-${CMAKE_C_COMPILER_ID}-${CMAKE_C_COMPILER_VERSION}")
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  include(CPack)
endif()
