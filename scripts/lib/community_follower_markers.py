"""Check that every generated follower-state reference has a native overlay."""
import re

PATTERN = r'\bMCF[0-9A-F]{12}[1-4]\b'


def validate(document, source_texts):
    referenced = set().union(*(set(re.findall(PATTERN, text)) for text in source_texts))
    markers = {}
    for record in document.records:
        element = record.to_element()
        name = element.get('Name', '')
        if re.fullmatch(PATTERN, name):
            if name in markers:
                raise ValueError('Duplicate follower marker: ' + name)
            markers[name] = element
    if set(markers) != referenced:
        raise ValueError('Follower marker definitions/references differ: missing=' +
            repr(sorted(referenced - markers.keys())) + ', orphaned=' +
            repr(sorted(markers.keys() - referenced)))
    for name, element in markers.items():
        expected = {'Engine/Menu': '11', 'Engine/ImageIDBase': 'CRB2',
            'Engine/DefaultSound': '0', 'Game/DialogID': '0', 'Game/StackPriority': '0'}
        if (element.get('type') != 'Unit' or element.get('subType') != 'Overlay'
                or not re.fullmatch(r'MF[A-Z0-9]{2}', element.get('ID', ''))
                or [e.get('value') for e in element.findall('Engine/Info')] !=
                    ['Directionless', 'DontBlock', 'NotVisibleInISOView']
                or element.find('Engine/Script') is not None
                or any(element.find(path) is None or element.find(path).get('value') != value
                       for path, value in expected.items())):
            raise ValueError('Follower marker differs from stock persistent overlay: ' + name)
    return sorted(markers)
