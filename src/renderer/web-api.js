'use strict';
/* window.api bridge. Chrome/Edge: pick a folder and save straight into a subfolder of it
   (File System Access API). Other browsers: pick/drop photos, results download as a .zip.
   Photos never leave the device. */
(() => {
  document.documentElement.classList.add('web');

  const JPG = /\.jpe?g$/i;
  const canPickDir = typeof window.showDirectoryPicker === 'function';
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  let roll = null;  // { name, dir: FileSystemDirectoryHandle|null, files: Map<name, File|FileSystemFileHandle> }
  let batch = null; // one develop run

  // Same rule as the desktop app: never overwrite, for any extension.
  // strip_001.webp → next free number, anything else → "name (2).webp".
  function candidateName(name, attempt) {
    if (attempt === 0) return name;
    const strip = name.match(/^strip_(\d+)(\.[a-z0-9]+)$/i);
    if (strip) return `strip_${String(+strip[1] + attempt).padStart(strip[1].length, '0')}${strip[2]}`;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${attempt + 1})${name.slice(dot)}` : `${name} (${attempt + 1})`;
  }

  // ---------- loading ----------
  async function fromDirHandle(dir) {
    const files = new Map(), list = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== 'file' || !JPG.test(name)) continue;
      const f = await h.getFile();
      files.set(name, h);
      list.push({ name, size: f.size, mtime: f.lastModified });
    }
    list.sort(byName);
    roll = { name: dir.name, dir, files };
    return { dir: dir.name, name: dir.name, files: list };
  }

  function fromFiles(fileList, label) {
    const files = new Map(), list = [];
    let name = label || '';
    for (const f of fileList) {
      if (!JPG.test(f.name)) continue;
      const parts = (f.webkitRelativePath || '').split('/');
      if (parts.length > 2) continue; // top-level photos only, like the desktop app
      if (!name && parts.length === 2) name = parts[0];
      if (files.has(f.name)) continue;
      files.set(f.name, f);
      list.push({ name: f.name, size: f.size, mtime: f.lastModified });
    }
    list.sort(byName);
    name = name || 'photos';
    roll = { name, dir: null, files };
    return { dir: name, name, files: list };
  }

  function pickWithInput() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.jpg,.jpeg,image/jpeg';
      const folderMode = !matchMedia('(pointer: coarse)').matches; // phones: pick photos instead of a folder
      if (folderMode) input.webkitdirectory = true;
      input.onchange = () => resolve(input.files.length ? fromFiles([...input.files], folderMode ? '' : 'photos') : null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  function readDirEntry(entry) {
    return new Promise((resolve, reject) => {
      const reader = entry.createReader(), out = [];
      const next = () => reader.readEntries(async (batchOf) => {
        if (!batchOf.length) {
          try { resolve(await Promise.all(out.map((e) => new Promise((ok, no) => e.file(ok, no))))); } catch (err) { reject(err); }
          return;
        }
        for (const e of batchOf) if (e.isFile && JPG.test(e.name)) out.push(e);
        next();
      }, reject);
      next();
    });
  }

  // ---------- saving ----------
  async function uniqueFileHandle(dir, name) {
    for (let attempt = 0; attempt < 10000; attempt++) {
      const n = candidateName(name, attempt);
      try {
        await dir.getFileHandle(n); // exists → try the next name
      } catch (err) {
        if (err.name === 'NotFoundError') return { name: n, handle: await dir.getFileHandle(n, { create: true }) };
        throw err;
      }
    }
    throw new Error('Could not find a free file name for ' + name);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    api._lastDownload = { name, blob }; // used by tests
  }

  const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  // Minimal ZIP writer (stored, no compression — JPEGs don't shrink further).
  function makeZip(items) {
    const enc = new TextEncoder(), parts = [], central = [], now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    let offset = 0;
    for (const it of items) {
      const nm = enc.encode(it.name), crc = crc32(it.data), size = it.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nm.length, true);
      parts.push(lh.buffer, nm, it.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, nm);
      offset += 30 + nm.length + size;
    }
    const cdSize = central.reduce((a, p) => a + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, items.length, true); end.setUint16(10, items.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  const api = {
    kind: 'web',
    canPickDir,

    async pickFolder() {
      if (canPickDir) {
        try {
          return await fromDirHandle(await window.showDirectoryPicker({ id: 'photoset-roll', mode: 'readwrite' }));
        } catch (err) {
          if (err.name === 'AbortError') return null;
          if (err.name !== 'SecurityError' && err.name !== 'TypeError') throw err; // e.g. inside an iframe → fall back
        }
      }
      return pickWithInput();
    },

    // Called synchronously from the drop event: DataTransfer items must be read before any await.
    openDrop(dt) {
      const items = [...(dt.items || [])].filter((i) => i.kind === 'file');
      const handles = canPickDir && items.length && items[0].getAsFileSystemHandle ? items.map((i) => i.getAsFileSystemHandle()) : null;
      const entries = handles ? null : items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
      const plain = [...dt.files];
      return (async () => {
        if (handles) {
          const hs = (await Promise.all(handles)).filter(Boolean);
          const dir = hs.find((h) => h.kind === 'directory');
          if (dir) return fromDirHandle(dir);
          return fromFiles(await Promise.all(hs.filter((h) => h.kind === 'file').map((h) => h.getFile())), 'dropped photos');
        }
        const dirEntry = entries.find((e) => e.isDirectory);
        if (dirEntry) return fromFiles(await readDirEntry(dirEntry), dirEntry.name);
        return fromFiles(plain, 'dropped photos');
      })();
    },

    async readFile(name) {
      const src = roll && roll.files.get(name);
      if (!src) throw new Error('Not in this roll: ' + name);
      const file = src.getFile ? await src.getFile() : src;
      return new Uint8Array(await file.arrayBuffer());
    },

    async beginBatch(folder) {
      batch = { folder, dir: null, items: [], names: new Set() };
      if (roll && roll.dir) {
        let perm = await roll.dir.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') perm = await roll.dir.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
        if (perm === 'granted') batch.dir = await roll.dir.getDirectoryHandle(folder, { create: true });
      }
      return batch.dir ? 'folder' : 'download';
    },

    // type: the output mime type, so downloads and zips carry it. Defaults to JPEG.
    async writeFile(folder, name, data, type) {
      type = type || 'image/jpeg';
      if (batch && batch.dir) {
        const out = await uniqueFileHandle(batch.dir, name);
        const w = await out.handle.createWritable();
        await w.write(data);
        await w.close();
        return `${roll.name}/${folder}/${out.name}`;
      }
      const used = batch ? batch.names : new Set();
      let n = name;
      for (let a = 1; used.has(n.toLowerCase()); a++) n = candidateName(name, a);
      used.add(n.toLowerCase());
      if (batch) batch.items.push({ name: n, data: new Uint8Array(data), type });
      else download(new Blob([data], { type }), n);
      return n;
    },

    // Hands the results over: nothing to do for folder mode; one file or a .zip for download mode.
    async endBatch() {
      const b = batch;
      batch = null;
      if (!b || b.dir || !b.items.length) return null;
      if (b.items.length === 1) {
        download(new Blob([b.items[0].data], { type: b.items[0].type }), b.items[0].name);
        return b.items[0].name;
      }
      const zipName = `${roll.name}-${b.folder}.zip`;
      download(makeZip(b.items), zipName);
      return zipName;
    },

    outputLabel(folder) {
      if (!roll) return canPickDir ? 'Saves into a subfolder · originals untouched' : 'Results download as a .zip';
      return roll.dir ? `Saves to ${roll.name}/${folder}/ · originals untouched` : `Downloads as ${roll.name}-${folder}.zip`;
    },

    openOutput: async () => {},
    // test helpers
    fromFiles,
    fromDirHandle,
  };
  window.api = api;
})();
