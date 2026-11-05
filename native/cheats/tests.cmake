# Include from an owned game's tests/CMakeLists.txt after linking source/ to this repo.
add_executable(instant_hero_level_tests ${RECOMP_GAME_DIR}/source/native/cheats/instant_level_tests.cpp)
target_include_directories(instant_hero_level_tests PRIVATE ${RECOMP_GAME_DIR}/source/native/cheats)
target_compile_features(instant_hero_level_tests PRIVATE cxx_std_17)
target_compile_options(instant_hero_level_tests PRIVATE ${POP_WARN_STRICT})
pop_optimize(instant_hero_level_tests 1)
pop_test_binary(instant_hero_level_tests)
add_test(NAME instant_hero_level_tests COMMAND instant_hero_level_tests)
set_tests_properties(instant_hero_level_tests PROPERTIES LABELS nogame TIMEOUT 15)
