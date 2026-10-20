"""Bounded GPL resource-call inspection, preserving strings and nested arguments."""
from dataclasses import dataclass
import re

# Description namespaces and zero-based argument positions. Native catalog names
# are case-insensitive; argument expressions must remain expressions, not guessed
# names from the first quoted substring (for example Hero's "special_splat").
RESOURCE_CALLS = {
    'createeffector': ('Unit', 1), 'checkeffector': ('Unit', 1),
    'learnspell': ('Action', 1),
    'forgetspell': ('Action', 1), 'isspellavailable': ('Action', 1),
    'bards_spell_available': ('Action', 1), 'getspellattribute': ('Action', 0),
    'castspell': ('Action', 1), 'cast': ('Action', 1),
    'changeunittype': ('Unit', 1),
    'spawnunit': ('Unit', 1), 'createspellunit': ('Unit', 1),
    'createmissile': ('Unit', 0), 'enableunittype': ('Unit', 0),
    'disableunittype': ('Unit', 0), 'playsound': ('Sound', 1),
}
TOKEN = re.compile(r'(?P<comment>//[^\n]*|/\*.*?\*/)|'
                   r'(?P<string>"(?:\\.|[^"\\])*")|'
                   r'(?P<ref>\$[A-Za-z_]\w*)|(?P<expression>#[A-Za-z_]\w*)|'
                   r'(?P<space>\s+)|(?P<other>.)', re.S)


def script_references(text):
    """Return script symbols outside strings/comments, including constants."""
    if len(text) > 2 * 1024 * 1024:
        raise ValueError('GPL inspection input exceeds its bound')
    for match in TOKEN.finditer(text):
        if match.lastgroup == 'ref':
            yield 'Function', match[0][1:].casefold()
        elif match.lastgroup == 'expression':
            yield 'Expression', match[0].casefold()


@dataclass(frozen=True)
class ResourceCall:
    method: str
    namespace: str
    name: str | None
    line: int


def resource_calls(text):
    """Inspect every call, including nested ones; never execute GPL input."""
    if len(text) > 2 * 1024 * 1024:
        raise ValueError('GPL inspection input exceeds its bound')
    tokens = [(m.lastgroup, m.group(), m.start()) for m in TOKEN.finditer(text)
              if m.lastgroup not in ('space', 'comment')]
    for i, (kind, value, start) in enumerate(tokens):
        if kind != 'ref' or value[1:].casefold() not in RESOURCE_CALLS:
            continue
        if i + 1 >= len(tokens) or tokens[i + 1][1] != '(':
            continue  # A function value is not a resource lookup.
        namespace, index = RESOURCE_CALLS[value[1:].casefold()]
        depth, args, argument = 1, [], []
        for token_index in range(i + 2, len(tokens)):
            token = tokens[token_index]
            word = token[1]
            if token[0] != 'string':
                if word == '(':
                    depth += 1
                elif word == ')':
                    depth -= 1
                    if not depth:
                        args.append(argument)
                        break
                elif word == ',' and depth == 1:
                    args.append(argument)
                    argument = []
                    continue
            argument.append(token)
        else:
            raise ValueError('Unterminated GPL resource call')
        if depth or len(args) <= index or not args[index]:
            raise ValueError('Incomplete GPL resource call: ' + value + ' at line ' + str(text.count('\n', 0, start) + 1))
        if value[1:].casefold() == 'playsound' and len(args) == 2:
            # Retail also accepts PlaySound(agent, flags), selecting the
            # actor's default sound. Those VFX flags are not catalog names.
            continue
        arg = args[index]
        name = arg[0][1][1:-1] if len(arg) == 1 and arg[0][0] == 'string' else None
        if name is not None and ('\\' in name or not name or len(name) > 128):
            raise ValueError('Unsupported literal native resource name')
        yield ResourceCall(value[1:], namespace, name, text.count('\n', 0, start) + 1)


def literal_attribute_writes(text, field):
    """Find complete literal writers of a GPL field used as a resource name.

    Dynamic expressions remain None. Comments, field comparisons and a literal
    prefix concatenated with a variable cannot prove a complete resource name.
    """
    tokens = [(m.lastgroup, m.group(), m.start()) for m in TOKEN.finditer(text)
              if m.lastgroup not in ('space', 'comment')]
    for i in range(len(tokens) - 4):
        if not (tokens[i][1] == "'" and tokens[i + 1][1].casefold() == 's'
                and tokens[i + 2][0] == 'string'
                and tokens[i + 2][1][1:-1].casefold() == field.casefold()
                and tokens[i + 3][1] == '=' and tokens[i + 4][1] != '='):
            continue
        value = tokens[i + 4]
        name = value[1][1:-1] if (value[0] == 'string' and i + 5 < len(tokens)
                                 and tokens[i + 5][1] == ';') else None
        yield name, text.count('\n', 0, tokens[i][2]) + 1
