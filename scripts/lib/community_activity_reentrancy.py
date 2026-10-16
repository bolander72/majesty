"""Keep the original kingdom root across reentrant activity cancellation."""
import re


def restore_activity_root(text):
    """Change one post-callback lookup; refuse unreviewed dispatcher shapes.

    Native2123 observed MM_AD_Change -> Notify -> street-show cancellation ->
    MM_AD_Change, followed by the outer StopIfEmpty reading agent -1. Its Root
    local is not retained through that nested call in the Old VM. No caller
    local is needed after Notify: reacquire the original named kingdom root.
    Ledger removal, callback order, reasons, timing and rewards stay intact.
    """
    matches = list(re.finditer(r'(?im)^function MM_AD_Change\([^\n]*\)[^\n]*$', text))
    if len(matches) != 1:
        raise ValueError('Require exactly one original activity-change dispatcher')
    start = matches[0].start()
    following = re.search(r'(?im)^function\s+', text[matches[0].end():])
    end = matches[0].end() + following.start() if following else len(text)
    body = text[start:end]
    signature = ('function MM_AD_Change(string Identity, agent Owner, integer Key, '
                 'integer Action) is integer')
    if body.splitlines()[0].strip().casefold() != signature.casefold():
        raise ValueError('Activity dispatcher signature changed')
    fragment = ('            $MM_AD_Notify(Identity, Owner, Subject, Context, Key, 1);\n'
                '            $MM_AD_StopIfEmpty(Root);')
    if body.count(fragment) != 1 or body.count('$MM_AD_StopIfEmpty(Root);') != 1:
        raise ValueError('Activity cancellation callback/root sequence changed')
    tail = body.split(fragment, 1)[1]
    if not re.fullmatch(r'\s*end\s+return\s+1;\s*end\s*', tail, flags=re.I):
        raise ValueError('Activity dispatcher post-callback flow changed')
    replacement = fragment.replace('$MM_AD_StopIfEmpty(Root);',
                                   '$MM_AD_StopIfEmpty($MM_AD_Root());')
    return text[:start] + body.replace(fragment, replacement, 1) + text[end:]
