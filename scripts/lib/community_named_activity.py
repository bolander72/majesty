"""Lower named SpecifyIntent literals to the pinned VM's integer contract."""
import hashlib
from itertools import islice
from majesty_cam.gpl_function_merge import _LEX


def calls(text):
    tokens = [m for m in _LEX.finditer(text)
              if not m.group().isspace() and not m.group().startswith(('//', '/*'))]
    for i, token in enumerate(tokens):
        if token.group().casefold() != '$specifyintent':
            continue
        if i + 1 >= len(tokens) or tokens[i + 1].group() != '(':
            raise ValueError('Malformed SpecifyIntent call')
        depth, arguments = 1, [[]]
        for item in islice(tokens, i + 2, None):
            value = item.group()
            if value == ')' and depth == 1:
                break
            if value == ',' and depth == 1:
                arguments.append([])
            else:
                arguments[-1].append(item)
            depth += (value == '(') - (value == ')')
        else:
            raise ValueError('Unclosed SpecifyIntent call')
        if len(arguments) != 2:
            raise ValueError('Unexpected SpecifyIntent argument count')
        argument = arguments[1]
        if len(argument) == 1 and argument[0].group().startswith('"'):
            literal = argument[0]
            name = literal.group()[1:-1]
            if not name or '\\' in name:
                raise ValueError('Unsupported named activity literal')
            yield name, literal.start(), literal.end()


def private_id(guid, name):
    seed = (guid.casefold() + ':named-activity:' + name.casefold()).encode('ascii')
    return 0x60000000 | (int.from_bytes(hashlib.sha256(seed).digest()[:4], 'little') & 0x0fffffff)


def rewrite(text, bindings):
    edits, counts = [], {}
    for name, start, end in calls(text):
        if name not in bindings:
            raise ValueError('Unbound named activity: ' + name)
        identity = bindings[name]['id']
        if not 0x60000000 <= identity <= 0x6fffffff:
            raise ValueError('Named activity outside private namespace')
        edits.append((start, end, '#MMM_AITX_' + format(identity, '08X')))
        counts[name] = counts.get(name, 0) + 1
    for start, end, replacement in reversed(edits):
        text = text[:start] + replacement + text[end:]
    return text, counts
