"""Conservative projection tests for native-only fixture source custody."""
import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('fixture_source',Path(__file__).parents[1]/'scripts/audit-native-coop-fixture-source.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
project=module.browser_projection

def test_native_branch_is_erased_but_browser_else_is_retained():
    assert project('a\n#ifndef __EMSCRIPTEN__\nnative\n#else\nbrowser\n#endif\nz\n')=='a\nbrowser\nz\n'

def test_opaque_nested_directives_do_not_escape_native_branch():
    assert project('#ifndef __EMSCRIPTEN__\n#if OTHER\nx\n#else\ny\n#endif\n#endif\nreal\n')=='real\n'

def test_opaque_browser_conditions_remain_exact():
    text='#if OTHER\nx\n#else\ny\n#endif\n'
    assert project(text)==text

@pytest.mark.parametrize('text',['#endif\n','#else\n','#ifdef __EMSCRIPTEN__\n','#ifdef __EMSCRIPTEN__\nx\n#elif OTHER\ny\n#endif\n'])
def test_ambiguous_or_unbalanced_projection_refused(text):
    with pytest.raises(ValueError):project(text)
