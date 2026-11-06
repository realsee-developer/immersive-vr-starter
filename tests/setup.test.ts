import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
const script=resolve(import.meta.dirname,'../scripts/select-framework.mjs');
test('all frameworks are selected inside one project without touching user environment',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'realsee-framework-'));
 try{
  await writeFile(resolve(root,'.env'),'LOCAL_USER_VALUE=kept\n');
  for(const framework of ['react','vue','typescript']){
   execFileSync(process.execPath,[script,'--framework',framework],{cwd:root,stdio:'pipe'});
   assert.deepEqual(JSON.parse(await readFile(resolve(root,'.starter.json'),'utf8')),{framework});
   assert.equal(await readFile(resolve(root,'.env'),'utf8'),'LOCAL_USER_VALUE=kept\n');
  }
  assert.throws(()=>execFileSync(process.execPath,[script,'--framework','invalid'],{cwd:root,stdio:'pipe'}));
  assert.deepEqual(JSON.parse(await readFile(resolve(root,'.starter.json'),'utf8')),{framework:'typescript'});
 }finally{await rm(root,{recursive:true,force:true})}
});
