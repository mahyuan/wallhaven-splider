const MongoClient = require('./mongo');
const EventEmitter = require('events');

/**
 * remove数据后使用 db.repairDatabase() 释放磁盘
 * 一定要先停止读写数据才能执行该方法
 */

class CleanTarget {
  constructor() {
    this.db = new MongoClient();
    this.Thumb = this.db.Thumb;
    this.Event = new EventEmitter();
    this.count = 0;
    this.Event.on('update', (data) => {
      this.handler(data);
    });
  }
  /**
   * 启动函数
   */
  async init() {
    // 获取数据条数
    let count = await this.Thumb.find().countDocuments();

    if(count) {
      this.count = count;
      this.loop();
    }
  }
  /**
   * 遍历，依次更新
   */
  async loop() {
    // 7896
    const limit = 10;
    const len = Math.ceil(this.count / limit);
    const arr = Array.from(new Array(len), (a,i) => i);

    for(let i of arr) {
      let skip = parseInt(i) * limit;

      let result = await this.Thumb.find({}, null, {skip, limit: 1000});
      console.log('----range---', i);
      await this.handler(result);
    }
  }

  async handler(data) {
    if(Array.isArray(data)) {
      for (const item of data) {
        const id = item.id;
        const fullThumb = `https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`;

        let result = await this.Thumb.updateOne({'id': item.id}, { $set: {'fullThumb': fullThumb }});
        console.log('result--', result);
      }
    }
  }
}
let target = new CleanTarget();
target.init();

