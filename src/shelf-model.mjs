export function shelfBookId(entry) {
  return String(entry && typeof entry === 'object' ? entry.bookId ?? '' : entry ?? '');
}

export function shelfMd5(text) {
  const bytes = new TextEncoder().encode(String(text));
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 128;
  const data = new DataView(padded.buffer);
  data.setUint32(padded.length - 8, bytes.length * 8, true);
  data.setUint32(padded.length - 4, Math.floor(bytes.length / 0x20000000), true);
  const state = [0x67452301,0xefcdab89,0x98badcfe,0x10325476];
  const shifts = [[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
  const constants = Array.from({length:64},(_,index)=>Math.floor(Math.abs(Math.sin(index+1))*0x100000000)>>>0);
  for (let offset=0;offset<padded.length;offset+=64) {
    let [a,b,c,d] = state;
    for (let index=0;index<64;index++) {
      let f,g;
      if(index<16){f=(b&c)|(~b&d);g=index;}
      else if(index<32){f=(d&b)|(~d&c);g=(5*index+1)%16;}
      else if(index<48){f=b^c^d;g=(3*index+5)%16;}
      else {f=c^(b|~d);g=(7*index)%16;}
      const sum=(a+f+constants[index]+data.getUint32(offset+g*4,true))|0;
      const shift=shifts[Math.floor(index/16)][index%4];
      const next=(b+((sum<<shift)|(sum>>>(32-shift))))|0;
      a=d;d=c;c=b;b=next;
    }
    [a,b,c,d].forEach((value,index)=>{state[index]=(state[index]+value)>>>0;});
  }
  return state.map(value=>[0,8,16,24].map(shift=>((value>>>shift)&255).toString(16).padStart(2,'0')).join('')).join('');
}

// Reconstructed from the shipped URL codec (module 156). This formats an
// existing book identifier; it does not grant reading access.
export function encodeShelfId(value) {
  const id=String(value); const digest=shelfMd5(id); const numeric=/^\d*$/.test(id);
  const chunks=[];
  if(numeric) for(let offset=0;offset<id.length;offset+=9) chunks.push(parseInt(id.slice(offset,offset+9),10).toString(16));
  else chunks.push([...id].map(character=>character.charCodeAt(0).toString(16)).join(''));
  let encoded=digest.slice(0,3)+(numeric?'3':'4')+'2'+digest.slice(-2);
  encoded+=chunks.map(chunk=>chunk.length.toString(16).padStart(2,'0')+chunk).join('g');
  if(encoded.length<20) encoded+=digest.slice(0,20-encoded.length);
  return encoded+shelfMd5(encoded).slice(0,3);
}

export function orderShelfGroups(groups, remembered = []) {
  const remaining=new Map(groups.map(group=>[String(group.id),group]));
  const result=[];
  for(const id of [...(Array.isArray(remembered)?remembered:[]),...remaining.keys()]) {
    const key=String(id);
    if(remaining.has(key)) { result.push(remaining.get(key)); remaining.delete(key); }
  }
  return result;
}

export function moveShelfGroup(ids, source, target, after = false) {
  if(source===target || !ids.includes(source) || !ids.includes(target)) return [...ids];
  const next=ids.filter(id=>id!==source);
  next.splice(next.indexOf(target)+(after?1:0),0,source);
  return next;
}

export function makeShelfCatalog(index, full, extraBooks = [], emptyIds = [], mpBook = null) {
  const unavailable = new Set(emptyIds.map(shelfBookId));
  const books = new Map();
  for (const book of [...(full.books || []), ...(full.lectureBooks || []), ...extraBooks, ...(mpBook ? [mpBook] : [])]) {
    if (book?.bookId != null && book.cover && book.title) books.set(String(book.bookId), book);
  }
  const groups = (index.archive || []).map(group => {
    const removed = new Set((group.removed || []).map(shelfBookId));
    return {
      id: String(group.archiveId), name: String(group.name),
      ids: [...new Set((group.bookIds || []).map(shelfBookId))].filter(id => id && !removed.has(id)),
    };
  });
  const grouped = new Set(groups.flatMap(group => group.ids));
  const rootIds = [...new Set((index.bookIds || []).map(shelfBookId))].filter(id => id && !grouped.has(id));
  if (mpBook && !grouped.has(String(mpBook.bookId)) && !rootIds.includes(String(mpBook.bookId))) {
    const position = rootIds.findIndex(id => Number(books.get(id)?.updateTime || 0) < Number(mpBook.updateTime || 0));
    rootIds.splice(position < 0 ? rootIds.length : position, 0, String(mpBook.bookId));
  }
  return {
    groups, books,
    view(groupId = '') {
      const group = groups.find(item => item.id === groupId);
      const ids = groupId ? group?.ids || [] : rootIds;
      return {
        name: groupId ? group?.name || '书籍' : '未分组',
        books: ids.filter(id => books.has(id)).map(id => books.get(id)),
        missing: ids.filter(id => !books.has(id) && !unavailable.has(id)).length,
      };
    },
  };
}
