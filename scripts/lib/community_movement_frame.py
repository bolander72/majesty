"""Audit the pinned native order's stack after its private step-load site."""
from collections import deque

START = 0x005b7490
LOAD = 0x005b75a2
DIRECT_CLEANUP = {
    0x004f6ba0: 8, 0x004f6bb9: 8, 0x004243e0: 8,
    0x005b77e0: 4, 0x005b7800: 4, 0x005b7820: 4,
    0x0042f130: 8, 0x005ade50: 12,
}
INDIRECT_CLEANUP = {0x005b7789: 16, 0x005b779b: 12, 0x005b77d0: 4}


def audit_frame(code, loan=0x18):
    import capstone as cs
    from capstone.x86_const import X86_OP_IMM, X86_OP_MEM, X86_OP_REG, X86_REG_ESP
    if loan < 0x10 or loan >= 0x3c or loan % 4:
        raise ValueError('Movement loan must be a local, not a saved register or argument')
    decoder = cs.Cs(cs.CS_ARCH_X86, cs.CS_MODE_32)
    decoder.detail = True
    instructions = {ins.address: ins for ins in decoder.disasm(code, START)}
    queue = deque([(LOAD, 0)])
    visited, references, returns, stack_at = set(), set(), set(), {}
    while queue:
        address, stack = queue.popleft()
        if (address, stack) in visited:
            continue
        visited.add((address, stack))
        if len(visited) > 1024 or address not in instructions:
            raise ValueError('Native movement control flow left its bounded function')
        if address in stack_at and stack_at[address] != stack:
            raise ValueError('Inconsistent native movement stack at a branch join')
        stack_at[address] = stack
        ins = instructions[address]
        for operand in ins.operands:
            if operand.type == X86_OP_MEM and operand.mem.base == X86_REG_ESP:
                if operand.mem.index:
                    raise ValueError('Unsupported indexed native stack access')
                references.add((address, stack + operand.mem.disp, max(4, operand.size)))
        next_address = address + ins.size
        name = ins.mnemonic
        if name == 'push':
            stack -= 4
        elif name == 'pop':
            stack += 4
        elif name in ['add', 'sub'] and ins.operands[0].type == X86_OP_REG and ins.operands[0].reg == X86_REG_ESP:
            if ins.operands[1].type != X86_OP_IMM:
                raise ValueError('Unsupported native stack adjustment')
            stack += ins.operands[1].imm * (1 if name == 'add' else -1)
        elif name == 'call':
            if ins.operands[0].type == X86_OP_IMM:
                target = ins.operands[0].imm
                if target not in DIRECT_CLEANUP:
                    raise ValueError('Unaudited native movement callee')
                stack += DIRECT_CLEANUP[target]
            else:
                if address not in INDIRECT_CLEANUP:
                    raise ValueError('Unaudited native movement virtual call')
                stack += INDIRECT_CLEANUP[address]
        elif name.startswith('ret'):
            cleanup = ins.operands[0].imm if ins.operands else 0
            returns.add((stack + 4 + cleanup, cleanup))
            continue
        elif name.startswith('j'):
            if ins.operands[0].type != X86_OP_IMM:
                raise ValueError('Unsupported native movement branch')
            queue.append((ins.operands[0].imm, stack))
            if name == 'jmp':
                continue
        queue.append((next_address, stack))
    if returns != {(0x5c, 12)}:
        raise ValueError('Native movement no longer restores its original frame and RET12')
    conflicts = [r for r in references if r[1] < loan + 4 and loan < r[1] + r[2]]
    if conflicts:
        raise ValueError(f'Native movement reuses loan +{loan:02x} at {conflicts[0][0]:08x}')
    if (0x005b771c, 0x20, 4) not in references:
        raise ValueError('Native position-assembly alias anchor differs')
    return dict(loanOffset=loan, originalReturnCleanup=12, visitedInstructions=len(visited),
                originalStackRestored=True,
                rejectedOldLoan=dict(offset=0x20, reuseAt='005b771c'),
                stackReferences=[dict(at=f'{a:08x}', offset=o, bytes=n)
                                 for a, o, n in sorted(references)])
