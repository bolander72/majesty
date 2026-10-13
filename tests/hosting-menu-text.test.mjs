import test from 'node:test';
import assert from 'node:assert/strict';
import {removeMenuTextShadows} from '../web/hosting/menu-text.mjs';

const missing = () => {throw new DOMException('Absent', 'NotFoundError');};
class Directory {
  constructor(entries = {}) {this.entries = entries;}
  async getDirectoryHandle(name) {return this.entries[name] || missing();}
  async getFileHandle(name) {return this.entries[name] ? {getFile: async () => this.entries[name]} : missing();}
  async removeEntry(name) {delete this.entries[name];}
}

test('cleanup removes only known generated resources and preserves custom text and layout', async () => {
  const data = new Directory({
    'textdata.cam': {size: 363864, hash: 'f5cbb50e01c78042366e287dac3db4af66db5bfcffe4a21935f91f6effda0898'},
    'mx_textdata.cam': {size: 139119, hash: 'customized'},
    'UIData_1280_633.dat': {size: 100, hash: 'layout'},
  });
  const root = new Directory({majesty: new Directory({profile: new Directory({Data: data})})});
  const removed = await removeMenuTextShadows({profilePath: 'majesty/profile',
    storage: {getDirectory: async () => root}, digest: async file => file.hash});
  assert.equal(removed, 1);
  assert.equal(data.entries['textdata.cam'], undefined);
  assert.equal(data.entries['mx_textdata.cam'].hash, 'customized');
  assert.equal(data.entries['UIData_1280_633.dat'].hash, 'layout');
});

test('fresh profiles need no cleanup or writes', async () => {
  assert.equal(await removeMenuTextShadows({profilePath: 'majesty/profile',
    storage: {getDirectory: async () => new Directory()}}), 0);
});

test('invalid profiles are refused before touching storage', async () => {
  await assert.rejects(removeMenuTextShadows({profilePath: 'majesty/profile/../game',
    storage: {getDirectory: () => assert.fail()}}), /Invalid menu/);
});
