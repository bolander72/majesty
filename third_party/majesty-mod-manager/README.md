# Original Mod Manager modules

These unmodified Python data/GPL composition modules and portable C++
MMFR/MMCR parsers come from Phantomstar721's
[Majesty Mod Manager](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager)
at commit `63a81840e0f9264067d7984ad0d2b39859fa1896`.

They provide the community's actual typed feature validation, controller
resolution and MMCP/MMFR/MMCR encoders/decoders. Their exact file hashes are
bound by `content/community-mods/alchemist/source-contract.json`.
`scripts/stage-alchemist-runtime-registries.py` validates them before use.

The upstream MIT license is preserved in `LICENSE`. This subset includes no
retail assets, mod media, compiled native DLL, launcher, account integration or GUI.
It does not make the browser runtime support the capabilities it encodes.

The original description codec and potion/typed-provider composers are also
used to apply the acquired Alchemist package's declared source policies.
Generated stock/mod source remains private; it is not vendored here.
