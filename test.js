const mongo = require('./mongo');

async function init() {
  const db = await new mongo();
  console.log('db', db);
  //   await db.Thumb.findOneAndUpdate({});

  // let r2 = await db.Thumb.updateOne({tid: '123' }, {$set: { age: 'haha' }});
  // console.log('r2', r2);
  db.Thumb.updateOne({tid: '123' }, {$set: { aaa: 'haha' }} , (err, result) => {
    if(err) {
      console.log('---err---', err);
    } else {
      console.log('result---', result);
      db.Thumb.find({ tid: '123'}, (e, res) => {
        if(e) {
          console.log('find- e', e);
        } else {
          console.log('---res--', res);
        }
      });
    }
  } );
  //   let r1 = await db.Thumb.find({ tid: '123'});
  //   console.log('res', r1);


  if(db) {
    let c = await db.close();
    console.log('c',c);
  }
}
init();