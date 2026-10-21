find_package(Qt6 6.7 REQUIRED COMPONENTS Quick Gui Qml QuickControls2 QuickDialogs2)
set(CMAKE_AUTOMOC ON)

add_library(parsegraph_qt_document STATIC GraphDocument.cpp GraphDocument.h)
target_compile_features(parsegraph_qt_document PUBLIC cxx_std_17)
target_include_directories(parsegraph_qt_document PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(parsegraph_qt_document PUBLIC parsegraph Qt6::Gui)

add_library(parsegraph_qt_view STATIC GraphView.cpp GraphView.h)
target_link_libraries(parsegraph_qt_view PUBLIC parsegraph_qt_document Qt6::Quick)

qt_add_executable(parsegraph_viewer main.cpp)
target_link_libraries(parsegraph_viewer PRIVATE parsegraph_qt_view Qt6::Qml Qt6::QuickControls2 Qt6::QuickDialogs2)
set_target_properties(parsegraph_viewer PROPERTIES
  MACOSX_BUNDLE TRUE
  MACOSX_BUNDLE_BUNDLE_NAME "Parsegraph Viewer"
  MACOSX_BUNDLE_GUI_IDENTIFIER "com.parsegraph.native-viewer"
  WIN32_EXECUTABLE TRUE)
qt_add_resources(parsegraph_viewer "viewer_assets"
  PREFIX "/viewer"
  FILES Main.qml assets/proportion.parsegraph)

if(BUILD_TESTING)
  find_package(Qt6 6.7 REQUIRED COMPONENTS Test)
  add_executable(qt_document_test tests/document_test.cpp)
  target_compile_definitions(qt_document_test PRIVATE PG_SOURCE_ROOT="${CMAKE_CURRENT_SOURCE_DIR}/../..")
  target_link_libraries(qt_document_test PRIVATE parsegraph_qt_document)
  add_test(NAME qt_document COMMAND qt_document_test)
  set_tests_properties(qt_document PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")

  add_executable(qt_viewer_test tests/viewer_test.cpp)
  target_compile_definitions(qt_viewer_test PRIVATE PG_SOURCE_ROOT="${CMAKE_CURRENT_SOURCE_DIR}/../..")
  target_link_libraries(qt_viewer_test PRIVATE parsegraph_qt_view Qt6::Test)
  add_test(NAME qt_viewer COMMAND qt_viewer_test)
  set_tests_properties(qt_viewer PROPERTIES ENVIRONMENT "QSG_RENDER_LOOP=basic" TIMEOUT 45)
endif()
