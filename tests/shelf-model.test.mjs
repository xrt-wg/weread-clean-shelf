import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeShelfCatalog,shelfMd5,encodeShelfId,orderShelfGroups,moveShelfGroup } from '../src/shelf-model.mjs';

test('local ordering ignores removed and duplicate groups, and appends newly added groups',()=>{
  const groups=['a','b','new'].map(id=>({id,name:id}));
  assert.deepEqual(orderShelfGroups(groups,['b','removed','b','a']).map(group=>group.id),['b','a','new']);
  assert.deepEqual(orderShelfGroups(groups,{}),groups);
});

test('moving a group preserves every group and handles both sides without changing input',()=>{
  const original=['a','b','c','d'];
  assert.deepEqual(moveShelfGroup(original,'a','c',true),['b','c','a','d']);
  assert.deepEqual(moveShelfGroup(original,'d','b'),['a','d','b','c']);
  assert.deepEqual(moveShelfGroup(original,'a','a'),original);
  assert.deepEqual(moveShelfGroup(original,'unknown','a'),original);
  assert.deepEqual(original,['a','b','c','d']);
});

test('URL hashing matches the platform MD5 implementation, including multi-block UTF-8 input',()=>{
  for(const value of ['', '3300143877', '微信读书', 'a'.repeat(200)]) assert.equal(shelfMd5(value),createHash('md5').update(value).digest('hex'));
});

test('reconstructed identifiers match actual native numeric and MP reader links',()=>{
  assert.equal(encodeShelfId('3300143877'),'e5632d00813ab9eb3g017963');
  assert.equal(encodeShelfId('MP_WXS_2390553873'),'1cb424e224d505f5758535f323339303535333837334be');
});

test('root excludes grouped books, retains native group order, and distinguishes explicitly unavailable metadata',()=>{
  const book=id=>({bookId:id,title:`Book ${id}`,cover:`/${id}.jpg`});
  const index={bookIds:[{bookId:'a'},{bookId:'b'},{bookId:'missing'},{bookId:'empty'}],archive:[{archiveId:1,name:'Group',bookIds:['b','a','b']}]};
  const model=makeShelfCatalog(index,{books:[book('a'),book('b')],lectureBooks:[]},[],[{bookId:'empty'}]);
  assert.deepEqual(model.view('1').books.map(item=>item.bookId),['b','a']);
  assert.equal(model.view('').books.length,0);
  assert.equal(model.view('').missing,1);
});

test('supplemental metadata and MP collection remain available without duplicating entries',()=>{
  const book=id=>({bookId:id,title:id,cover:`/${id}.jpg`,updateTime:1});
  const index={bookIds:[{bookId:'normal'},{bookId:'restored'}],archive:[]};
  const model=makeShelfCatalog(index,{books:[book('normal')]},[book('restored')],[],{...book('mp'),updateTime:2});
  assert.deepEqual(model.view('').books.map(item=>item.bookId),['mp','normal','restored']);
  assert.equal(model.view('').missing,0);
});
