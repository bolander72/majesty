// Validate exact stopped producers after the current runtime moves forward.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {hashNativeFile,NATIVE_SOURCES} from './native-generation.mjs';
import {workspace,ownedDirectory} from './stopped-entity-io.mjs';
const INITIALIZED_EXE='064a7bb4596bddc4723a3db04c531268dd4548fc93e05ee50aa5eff7b9939c9b';
const INITIALIZED_SOURCES={
 'upstream/majesty-recomp/browser_frontier.cpp':'00b02d4e731a2426a60f81202f19190e5dec248ef402f89ea0905b5e863e4cc4',
 'upstream/majesty-recomp/browser_streaming.cpp':'60d28e24d9557c9fcffd51de4bbbfc269701f806d7d672e51dd861d012fc24ec',
 'upstream/majesty-recomp/game.toml':'940dd6e289d683f9b4ae4e22fed21de5752c9c23b84bfaebc2ea507ac7006b6f'};
const INITIALIZED_SYMBOLS='48074948ca073b3143c4dfaac20005da385ae3701dd1483ca8052c447fc86b68';
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs].map(String).join(':');
const known=new Map([[INITIALIZED_EXE,{sources:INITIALIZED_SOURCES,symbols:INITIALIZED_SYMBOLS,report:'native-initialization-generation-045-preserved.json'}],
 ['1a8fe52a5418b097e67a2791c4b3cd18ac735f243208141b579bb907bc4428a3',{sources:{...INITIALIZED_SOURCES,'upstream/majesty-recomp/browser_streaming.cpp':'e6f72ff1e1997d0e3addbe95b33ae6a7736beb6eab2aab3998ee210aab72688b'},symbols:INITIALIZED_SYMBOLS,report:'native-home-validity-generation-047-preserved.json'}],
 ['3a31b87eac3c01e63f808cf091ed6503ca974514bf4ed505ac96146ce09f97c0',{sources:{...INITIALIZED_SOURCES,'upstream/majesty-recomp/browser_streaming.cpp':'1c31a28c694fe10e7725c317c6d4a5c3600c7f19b9b25a42994014d5e342b638'},symbols:INITIALIZED_SYMBOLS,report:'native-home-task-generation-056-preserved.json'}],
 ['aff0b44f9f3548601ce21fe457d69ce260ecc1d6d7854d1cd19505b5621acc56',{sources:{...INITIALIZED_SOURCES,'upstream/majesty-recomp/browser_frontier.cpp':'2209d75ba2e983ee93de5da72ba657b519ac79e60717ad54f16b913c92e54352','upstream/majesty-recomp/browser_streaming.cpp':'2b224f6b85166e1ab6719e640c5200e712b1f1cb27d2251b8a793c325e3e4c3c'},symbols:INITIALIZED_SYMBOLS,report:'native-home-motion-generation-057-preserved.json'}],
 ['6b66f3e04300906f44a01c1796d0cc364d6635eda01a560d22b86bcf4fc7c13e',{sources:{...INITIALIZED_SOURCES,'upstream/majesty-recomp/browser_frontier.cpp':'2209d75ba2e983ee93de5da72ba657b519ac79e60717ad54f16b913c92e54352','upstream/majesty-recomp/browser_streaming.cpp':'70e215304b6a244840e67c72413895c849cfed88bbbe16b78960d6eac91dac41'},symbols:INITIALIZED_SYMBOLS,report:'native-remote-home-generation-059-preserved.json'}]]);
const archived=new Map();
known.set('efaaaf89428286180a24ac562c1dced5c00ea66119f8e5d8034a9d91a588db2f',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae',
  'upstream/majesty-recomp/browser_streaming.cpp':'fb492c178a19f4fc682694b27f6f95b1daff665df289f8c176be6e2d63b80d89',
  'upstream/majesty-recomp/browser_campaign.cpp':'a6b0d6f347e1adebb9601ccd74f6d6c814802384416ccc00bb264e8ba2a1cae7',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-building-objective-generation-106-preserved.json'});
known.set('3ffa235bd3c5b9b3fb796325e6eba7702689bd4f04a9653f360f0ea3edd5d7b1',{sources:{"upstream/majesty-recomp/browser_frontier.cpp":"f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae","upstream/majesty-recomp/browser_streaming.cpp":"881b738ec1adb78cce0ff37bbdbaf845d4b29710eeae4960a8de3fffcd0ee720","upstream/majesty-recomp/game.toml":"c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',report:'native-connected-expansion-generation-102-preserved.json'});
known.set('53ac9494e582bb65b75df352997f66e2ea3da30cc570488c62c66bd95d4c4e6e',{sources:{"upstream/majesty-recomp/browser_frontier.cpp":"ae8b221fcf262fc7e75f493a59bbd4382f5004a98271adbbde748f4325f03896","upstream/majesty-recomp/browser_streaming.cpp":"881b738ec1adb78cce0ff37bbdbaf845d4b29710eeae4960a8de3fffcd0ee720","upstream/majesty-recomp/game.toml":"c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',report:'native-coordinate-travel-generation-099-preserved.json'});

known.set('c8de4fad7385a6d1e16f577488cea298294cc80589305a7b87bc2a28f5d50683',{
 sources:{
  "upstream/majesty-recomp/browser_frontier.cpp": "ae8b221fcf262fc7e75f493a59bbd4382f5004a98271adbbde748f4325f03896",
  "upstream/majesty-recomp/browser_streaming.cpp": "5036e8905896b7b1f8b60da67a446b3c176cb03bc7dd0907e3958dd2efb19779",
  "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"
},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-palace-death-generation-097-preserved.json'});

known.set('13a6e15b2d20747561de07a9ef2f1c84c7abaaf88a8fea10fce105651997d6c3',{
 sources:{
  "upstream/majesty-recomp/browser_frontier.cpp": "0e9c7354b15d6e3671ec327cecdf69d6105c35aa1336b2c96e0d1f6c78d8fc85",
  "upstream/majesty-recomp/browser_streaming.cpp": "4dfe94a746334b46f08a725628c79b019aa8a96250d3b314257fcf8cc4a5a7ee",
  "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"
},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-request-region-travel-generation-096-preserved.json'});

known.set('c4f88521e28ed60ec1dec435b399dbfeea7bdfeaefa698968706c85ddb4229eb',{
 sources:{
  "upstream/majesty-recomp/browser_frontier.cpp": "0e9c7354b15d6e3671ec327cecdf69d6105c35aa1336b2c96e0d1f6c78d8fc85",
  "upstream/majesty-recomp/browser_streaming.cpp": "22902f1ceea758eedaf51ebc8867825969eed5b528b070ab3612c2f25d07e0f2",
  "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"
},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-auto-region-load-generation-093-preserved.json'});

known.set('721c1e050cfc7d772a2acbc4143d1364f1181426b176085f20d3417f2abb7de3',{
 sources:{
  "upstream/majesty-recomp/browser_frontier.cpp": "ca38a1bbc921b89131c3b07dd78edd8148263ca93de2e5db23af265b1e46be1b",
  "upstream/majesty-recomp/browser_streaming.cpp": "c9c4a4c23da0845e578352a8e6be4fa4a0f558c9b86cc6aa9e99f28faa3351c3",
  "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"
},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-orphan-queue-retirement-generation-092-preserved.json'});

known.set('76c0c04132bb7ffc32e2166e340f2bfe924d1ccb19cdc89158003f694f76b132',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'ca38a1bbc921b89131c3b07dd78edd8148263ca93de2e5db23af265b1e46be1b',
  'upstream/majesty-recomp/browser_streaming.cpp':'e8e916aba30d519f190ad91dedc1ab9a85d98348720bd4f2c3e7a225581bac22',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-page-registration-generation-091-preserved.json'});
known.set('338715b83a505226b07b0718026ecdc06683cbb046bfcdce3c17742c3b302f10',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'ca38a1bbc921b89131c3b07dd78edd8148263ca93de2e5db23af265b1e46be1b',
  'upstream/majesty-recomp/browser_streaming.cpp':'87db34abd7f88496fc9be6f31e743f8246857d9ea1a10017da7db4c9ca954ac7',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-page-owner-generation-090-preserved.json'});
known.set('6cd39dca7edf8ebec270fd59082d4876d1c4cbb39978cbaa9c532a489dd4e653',{
 sources:{"upstream/majesty-recomp/browser_frontier.cpp": "ca38a1bbc921b89131c3b07dd78edd8148263ca93de2e5db23af265b1e46be1b", "upstream/majesty-recomp/browser_streaming.cpp": "cf1514629d41f8121b4878a8d68437b34c1a7fc0f130efc18f0f9b9f1f64f5a9", "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-idle-tile-gates-generation-088-preserved.json'});
known.set('cf9caa978eb84ecc9a54adefcdf7cba609b7049bf60ee416e74a03a019d658b4',{
 sources:{"upstream/majesty-recomp/browser_frontier.cpp": "ca38a1bbc921b89131c3b07dd78edd8148263ca93de2e5db23af265b1e46be1b", "upstream/majesty-recomp/browser_streaming.cpp": "7655d3bcd0f4575df7871ab886a511e584d1c5a0e8d2ab59c4b7591dbecd165c", "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-idle-tile-release-idle-generation-087-preserved.json'});
known.set('43c58b662cf749e38b36193484c93d3992218a4ef69c390a140d9ad932a2371b',{
 sources:{"upstream/majesty-recomp/browser_frontier.cpp": "88ed3fdd552c5b176c859cd5b7e488c525b62f627eb02727bb8ac306ec64c4b8", "upstream/majesty-recomp/browser_streaming.cpp": "2695070b97dcafc82e66944f76eb140587c234ef68bbcb81d33beadfc4cbfcd8", "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-idle-tile-release-active-generation-084-preserved.json'});
known.set('66f947787523886901d8c9119c73f521dff66f7e6ef8203ee1a519ffded8d712',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'88ed3fdd552c5b176c859cd5b7e488c525b62f627eb02727bb8ac306ec64c4b8',
  'upstream/majesty-recomp/browser_streaming.cpp':'eddf8f1a3a5e51bf1dd9471689e1990884fb815c9522a57fa2638a69d052c18d',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-region-travel-generation-082-preserved.json'});
known.set('d9eb483ac969aceb66433a94f6f0170e6145ef65ff624da591d6a0ff07a25d96',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'88ed3fdd552c5b176c859cd5b7e488c525b62f627eb02727bb8ac306ec64c4b8',
  'upstream/majesty-recomp/browser_streaming.cpp':'2b8574e05a72bc5595103cd1cfd481017ed2489fc8def5e942205008ac9c1b56',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-return-pair-reload-generation-081-preserved.json'});
known.set('941e987230a518b88067138ff40c8680d75caec04d7e5283dde639c4cfb1e5bb',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'f82e07429566a6e0b8900762fb8c3d1de4f423f49f2c067fbec4b41205c7615b',
  'upstream/majesty-recomp/browser_streaming.cpp':'4f3637b79c0bb2ebbb034c8e8b0972b4a42cc7ccf7c576c5a1c206e86ddf6489',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-remote-hero-departure-generation-080-preserved.json'});
known.set('dda3d7c836359c51c9be533539ea7640160e41267beffd0502e09737849e950a',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'0c147471ac8ad748513d07f419deec251ae8f7a31dafb63725d0da919e1f8494',
  'upstream/majesty-recomp/browser_streaming.cpp':'3ca4f6a3309ecf751878bed614c97de971253459d30461e5086bf10d518d5d78',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-return-live-generation-079-preserved.json'});
known.set('e60b8b908fa5f69d33e9ba9a246ac534f6fab482c232b9424f59373df9aff57e',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'783fa4184314ae10916eb77c2d439f970c3365e33acdfe8559a04dc3ee59017e',
  'upstream/majesty-recomp/browser_streaming.cpp':'ec6f95ab76488a1030e52b168d0f28a751ecad0b0b8480b1e588af47ecfc5cf4',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-return-generation-078-preserved.json'});
known.set('9599be152b634588c46682b4b7fcc0efe32233e1f4a8d48cb67e035248345e9f',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'d7fc52818fc3b90a2db41e1128f58fc843bc764537d7366a6006da966ae7fea9',
  'upstream/majesty-recomp/browser_streaming.cpp':'224cf2067f8e05abf3b3ed7943543b22f2f89be7e8308fafa101c9dfdceb6192',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-pair-reload-generation-076-preserved.json'});
known.set('6458be4aed09e977a273ed888a8abe2765ad5a31827a86e46d6847717da999f7',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'4412e474816b81c1d1167a082624abdec9e5c5529802541eda54eca6f42d80d6',
  'upstream/majesty-recomp/browser_streaming.cpp':'36c99071344057cf7bca584eb4b693b52fa9f388ae979e3fe08d5555e19ee50c',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-departure-generation-075-preserved.json'});
known.set('a6e10418d83c90b9fe46b982bd456586882121cbdb0b381625ea0c549e305a5f',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'75a26ff7025c4325ed472fe86171e50b532de790834e1d63ced0f273010c21e7',
  'upstream/majesty-recomp/browser_streaming.cpp':'d63b773bb822250a18255a3cac8b592148ddb43bb9afd3c2fc753a2547ca49ad',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-live-generation-074-preserved.json'});
known.set('8fab0f733af53d52372acfa2907984d4bb31d2707d02c2171e7be9177824b7ea',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'cc7bb32bacb96f9052c69feb665c731f1ba9881b61f7602ae620f62fdac9796e',
  'upstream/majesty-recomp/browser_streaming.cpp':'244dcc087c0de5d7b3d23e6723ec73ae476c3aae5fe0cc5c68aee047ff731150',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-reload-generation-068-preserved.json'});
known.set('9c1b06eeafa8ea5bdfc1b700ea0f1b10aff996c4526421b508b57df440b97f40',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'e7f4ec52e77d5c8343f10cdbd4ea6d6422b634fb55df1c6e4cdc2db91c88f5b2',
  'upstream/majesty-recomp/browser_streaming.cpp':'512ca00dd46cf750c3ac51df3cef19acc268c25a5470c11b1d4e467d3a9d4cd6',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-hero-import-generation-067-preserved.json'});
known.set('6b7e0bed82e009cb320077b9cc2ba7bab09daf7656d7f3783bd545fe403ba4a7',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'2209d75ba2e983ee93de5da72ba657b519ac79e60717ad54f16b913c92e54352',
  'upstream/majesty-recomp/browser_streaming.cpp':'7ef285703af98ad0415881af9e54274dd88d7c617037e3f36773de69cde1e535',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-marker-clock-generation-064-preserved.json'});
known.set('49a1561c8d0f41c7bee9e4b54e412242a2ff1bb3debfd709ee3e4688b14c1641',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae',
  'upstream/majesty-recomp/browser_streaming.cpp':'fb492c178a19f4fc682694b27f6f95b1daff665df289f8c176be6e2d63b80d89',
  'upstream/majesty-recomp/browser_campaign.cpp':'980eabf9179d60f79093412b8f6ea94dd6948dead5086a34d1e8ffe7c79b243b',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-constructed-predicate-generation-107-preserved.json'});
known.set('4988abb81b904f5eaf256fb8e6bb6089d4beb8b7fa1cbd326dae307fdcb1989a',{
 sources:{
  'upstream/majesty-recomp/browser_frontier.cpp':'f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae',
  'upstream/majesty-recomp/browser_streaming.cpp':'fb492c178a19f4fc682694b27f6f95b1daff665df289f8c176be6e2d63b80d89',
  'upstream/majesty-recomp/browser_campaign.cpp':'bd02923e32bccba40fe6fb051aa822f6f7f13a3d0ef79fafbb26481ba251e5c8',
  'upstream/majesty-recomp/game.toml':'c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80'},
 symbols:'5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450',
 report:'native-building-batch-generation-108-preserved.json'});
async function initializedArchive(executable,expected){
 if(!archived.has(executable))archived.set(executable,(async()=>{
  const filename=join(workspace,'output',expected.report);
  const info=await stat(filename,{bigint:true});assert.ok(info.isFile()&&info.size<=16384n);
  const a=JSON.parse(await readFile(filename,'utf8'));
  assert.equal(a.version,1);assert.equal(a.artifactPreserved,true);
  assert.deepEqual(a.nativeSourceSha256,expected.sources);
  assert.equal(a.nativeExecutable.sha256,executable);assert.equal(a.nativeSymbols.sha256,expected.symbols);
  const directory=await ownedDirectory(a.directory,'actor-arrival-fixture-native-generation-');
  const checks=new Map([[filename,stamp(info)]]);
  async function file(record,name,expected,maximum){assert.equal(record.filename,join(directory,name));const h=await hashNativeFile(record.filename,{maximum});assert.equal(h.sha256,expected);assert.equal(h.bytes,record.bytes);checks.set(record.filename,stamp(await stat(record.filename,{bigint:true})));}
  await file(a.nativeExecutable,'pop_smoke',executable,128*1024*1024);
  for(const name of Object.keys(expected.sources))await file(a.sources[name],name.split('/').at(-1),expected.sources[name],1024*1024);
  await file(a.nativeSymbols,'symbols.json',expected.symbols,32*1024*1024);
  return {symbols:a.nativeSymbols.filename,checks};
 })());
 const result=await archived.get(executable);
 for(const [file,before]of result.checks)assert.equal(stamp(await stat(file,{bigint:true})),before,'Preserved initialization artifact changed');
 return result.symbols;
}
known.set("d4765eb3f94311da61d9b37e5c25d6cb3b68e2f58e297843ed845d81f7e4df08",{sources:{"upstream/majesty-recomp/browser_frontier.cpp": "f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae", "upstream/majesty-recomp/browser_streaming.cpp": "7699bbe6bff243fe77028a91187dce3a1debace620abfa683cf5d380fc6cf411", "upstream/majesty-recomp/browser_campaign.cpp": "bd02923e32bccba40fe6fb051aa822f6f7f13a3d0ef79fafbb26481ba251e5c8", "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},symbols:"5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450",report:'native-coordinate-checkpoints-generation-109-preserved.json'});
known.set("c5d30c91489bab5150366d6623918cba8665788f2bda10c7e8d15b53352f6ebb",{sources:{"upstream/majesty-recomp/browser_frontier.cpp": "f49cc9fee3a1ec7168825012b0b73f52d3e8f2b2910d3858cfd78c33c95408ae", "upstream/majesty-recomp/browser_streaming.cpp": "30d438000ec98e43a3730c12f921b55384c5550bce98d4fb5e38a39d43d2a781", "upstream/majesty-recomp/browser_campaign.cpp": "bd02923e32bccba40fe6fb051aa822f6f7f13a3d0ef79fafbb26481ba251e5c8", "upstream/majesty-recomp/game.toml": "c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},symbols:"5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450",report:'native-coordinate-checkpoints-generation-110-preserved.json'});
known.set("e2eadf5940c82129c7ef8659af7db46e5632a9db57c9980eb3e838af66eaf3e3",{"sources":{"upstream/majesty-recomp/browser_frontier.cpp":"85317f6d39bc14bc793038d3397e80d3908cc28298e2fded852f6b23daed0f63","upstream/majesty-recomp/browser_streaming.cpp":"2ab2b887b2c25d31eb93ca189ade8af619243376d0b1e94d94f5ffb62487a505","upstream/majesty-recomp/browser_campaign.cpp":"bd02923e32bccba40fe6fb051aa822f6f7f13a3d0ef79fafbb26481ba251e5c8","upstream/majesty-recomp/game.toml":"c38890a2c02f9ea4bba9e555715e274e6dca10d9f890c0c733eb267c41541c80"},"symbols":"5e2f78d3eb7772252c1af388b42587f5a402667035888c63c2e92afaaddc2450","report":"native-coordinate-expansion-generation-111-preserved.json"});
export async function verifyConnectedNativeArtifact(manifest,build){
 assert.equal(manifest.nativeOnly,true);assert.equal(manifest.browserUsed,false);
 assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);
 assert.ok(Number.isInteger(manifest.nativePid)&&manifest.nativePid>0);
 try{process.kill(manifest.nativePid,0);throw Error('Native producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
 assert.equal(manifest.nativeExecutableSha256,build.nativeExecutableSha256);
 assert.deepEqual(manifest.nativeSourceSha256,build.nativeSourceSha256);
 const expected=known.get(manifest.nativeExecutableSha256);
 if(expected){
  assert.deepEqual(manifest.nativeSourceSha256,expected.sources);
  assert.equal(build.nativeSymbolsSha256,expected.symbols);
  return initializedArchive(manifest.nativeExecutableSha256,expected);
 }
 const sources=[...NATIVE_SOURCES];
 if(Object.hasOwn(manifest.nativeSourceSha256,'upstream/majesty-recomp/browser_campaign.cpp'))sources.push('upstream/majesty-recomp/browser_campaign.cpp');
 assert.deepEqual(Object.keys(manifest.nativeSourceSha256).sort(),sources.slice().sort());
 for(const name of sources)assert.equal((await hashNativeFile(join(workspace,name),{maximum:1024*1024})).sha256,manifest.nativeSourceSha256[name]);
 assert.equal((await hashNativeFile(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'))).sha256,manifest.nativeExecutableSha256);
 const symbols=join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json');
 assert.equal((await hashNativeFile(symbols,{maximum:32*1024*1024})).sha256,build.nativeSymbolsSha256);
 return symbols;
}
