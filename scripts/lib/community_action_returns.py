"""Preserve void actions when adapting generated callbacks to the Old integer ABI."""
from majesty_cam.action_callback_bridge import bridge_symbol, bridge_source
from majesty_cam.gpl import DefinitionKind, parse_gpl
from majesty_cam.gpl_function_merge import _tokens


def adapt(wrapper, callback):
    tokens = _tokens(callback.text)
    if (len(tokens) < 7 or tokens[:4] != ('function', callback.normalized_name, '(', 'agent')
            or tokens[5] != ')'):
        raise ValueError('Action callback must have one agent parameter')
    kind = tokens[7] if tokens[6] == 'is' else 'void'
    if kind not in ('boolean', 'void'):
        raise ValueError('Unsupported action return type: ' + kind)
    if wrapper.normalized_name != bridge_symbol(callback.name).casefold():
        raise ValueError('Generated action identity differs from its callback')
    fixed = f'''function {wrapper.name}(agent Subject) is integer
declare
begin
    ${callback.name}(Subject);
    return 1;
end
'''
    if kind == 'void' and _tokens(wrapper.text) == _tokens(fixed):
        return wrapper.text
    if _tokens(wrapper.text) != _tokens(bridge_source(callback.name)):
        raise ValueError('Generated action body requires review')
    return wrapper.text if kind == 'boolean' else fixed


def adapt_scoped(functions):
    changes = []
    for (scope, key), text in list(functions.items()):
        if key[0] is not DefinitionKind.FUNCTION or not key[1].startswith('mm_action_'):
            continue
        wrapper = parse_gpl(text).require(DefinitionKind.FUNCTION, key[1])
        calls = [token[1:] for token in _tokens(text) if token.startswith('$')]
        if len(calls) != 1:
            raise ValueError('Generated action must call its one owned callback')
        callback_key = (DefinitionKind.FUNCTION, calls[0])
        body = functions.get((scope, callback_key), functions.get(('Any', callback_key)))
        if body is None:
            raise ValueError('Generated action callback is missing')
        callback = parse_gpl(body).require(DefinitionKind.FUNCTION, calls[0])
        updated = adapt(wrapper, callback)
        if updated != text:
            functions[scope, key] = updated
            changes.append(dict(scope=scope, bridge=wrapper.name, callback=callback.name,
                                callbackReturnType='void'))
    return changes
