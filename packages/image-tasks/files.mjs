import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { crc32 } from "node:zlib";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const signature = Buffer.from("89504e470d0a1a0a","hex");
const maxBytes = 16 * 1024 * 1024;
export function pngInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > maxBytes || bytes.length < 45 ||
      !signature.equals(bytes.subarray(0,8))) throw Error("invalid-png");
  let data = false;
  for (let i=8; i+12<=bytes.length;) {
    const length=bytes.readUInt32BE(i), end=i+12+length;
    const type=bytes.toString("ascii",i+4,i+8);
    if (end>bytes.length || crc32(bytes.subarray(i+4,end-4))!==bytes.readUInt32BE(end-4)) throw Error("invalid-png-chunk");
    if (i===8 && (type!=="IHDR" || length!==13)) throw Error("invalid-png-header");
    if (type==="IDAT" && length>0) data=true;
    if (type==="IEND" && length===0 && end===bytes.length && data) {
      const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
      if (!width || !height || width*height>32000000) throw Error("invalid-png-size");
      return {width,height,format:"png"};
    }
    i=end;
  }
  throw Error("incomplete-png");
}

export class Originals {
  constructor(root) { this.root=root; }
  async save(bytes) {
    const info=pngInfo(bytes), digest=sha256(bytes), key=digest+".png";
    await mkdir(this.root,{recursive:true,mode:0o700});
    const temp=join(this.root,randomUUID()+".part");
    const file=await open(temp,"wx",0o600);
    try {
      try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
      await rename(temp,join(this.root,key));
      const read=await this.read(key,digest);
      if (!read) throw Error("original-write-verification");
      return {...info,sha256:digest,storageKey:key,size:read.length};
    } finally { await unlink(temp).catch(e=>{if(e.code!=="ENOENT")throw e;}); }
  }
  async read(key,digest) {
    if (!/^[a-f0-9]{64}$/.test(digest) || key!==digest+".png") return null;
    try {
      const path=join(this.root,key), stat=await lstat(path);
      if (!stat.isFile() || stat.size>maxBytes) return null;
      const bytes=await readFile(path);
      return sha256(bytes)===digest ? bytes : null;
    } catch(e) { if(e.code==="ENOENT")return null; throw e; }
  }
  // Run offline with writers stopped. Report only; shared digest files may have multiple owners.
  async audit(pool) {
    const assets=(await pool.query("SELECT record FROM yingjie_image.asset")).rows;
    const keys=new Set(),broken=[];
    for(const {record:a} of assets) {
      keys.add(a.storageKey);
      if(!await this.read(a.storageKey,a.sha256))broken.push(a.assetId);
    }
    const files=await readdir(this.root).catch(e=>{if(e.code==="ENOENT")return [];throw e;});
    return {broken,unreferenced:files.filter(k=>!keys.has(k))};
  }
}
