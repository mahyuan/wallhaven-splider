const request = require('request');
const cherrio = require( 'cheerio');
// const fs = require('fs')
// const path = require('path')
const EventEmitter = require('events');
const MongodbClient = require('./mongo');

// require('./loadenv')();


class Spider {
  constructor({ url = ''}) {
    this.url = url;
    this.currentPage = url.match(/\d+$/)[0];
    this.tag = this.url.replace(/https:\/\/\w+\.\w+\//, '').replace(/\?.*/, '');
    this.Event = new EventEmitter();
    this.db = new MongodbClient();

    this.Event.on('finished', () => {
      console.log('--finished called--');
      this.getNext();
    });

    this.Event.on('ended', () => {
      console.log('process exit.....');
      this.disconnect();
      process.exit(1);
    });
  }
  async disconnect() {
    let res = await this.db.close();
    console.log('disconnect', res);
  }
  init() {
    console.log('start load html', this.url);
    this.loadHtml(this.url, this.parseHtml);
  }

  getNext() {
    console.log('----start next----');
    this.currentPage = parseInt(this.currentPage) + 1;
    this.url = this.url.replace(/\d+$/, this.currentPage);
    setTimeout(() => {
      this.init();
    }, 5000);
  }

  loadHtml(url, done) {
    done = done.bind(this);
    const options = {
      method: 'GET',
      url: url,
      headers: {
        'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36"
      },
      timeout: 20000,
      Connection:'keep-alive',
      Referer: this.url
    };
    const callback = (err, res, body) => {
      if(err) {
        console.error('err', err);
        this.init();
      } else {
        console.log('---load html---', res.statusCode);
        if(res.statusCode === 200) {
          done(body);
        }
      }

    };
    console.log('---start request---');
    request(options, callback);
  }

  parseHtml(html) {
    const $ = cherrio.load(html);
    const nodeList = Array.from($('.thumb')).map(item => {
      const id = $(item).attr('data-wallpaper-id');
      const thumb = $(item).find($('img.lazyload')).attr('data-src');
      const like = $(item).find($('a.wall-favs')).text();
      const preview = $(item).find('a.preview').attr('href');
      const fullSrc = `https://wallhaven.cc/w/${id}`;
      // const full = `https://w.wallhaven.cc/full/ey/wallhaven-${id}.jpg`
      const fullThumb = `https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`;
      const wallRes = $(item).find('span.wall-res').text().split(/\s\x\s/g);
      const width = Number(wallRes[0]) || 0;
      const height = Number(wallRes[1]) || 0;
      return {
        id,
        tag: this.tag,
        thumb,
        like: Number(like) || 0,
        preview,
        width,
        height,
        // full,
        fullThumb,
        fullSrc
      };
    });
    console.log('--get nodeList count:--', nodeList.length);
    if(nodeList.length) {
      this.dbSave(nodeList);
    } else {
      console.log('not data in current page', this.url);
      this.Event.emit('ended');
    }
  }

  async dbSave(list = []) {
    if(list.length <= 0) {
      this.Event.emit('finished');
      return;
    }

    const newData = [];
    const updateData = [];
    for(let obj of list) {
      const existsList = await this.db.find({thumb: obj.thumb });
      if(Array.isArray(existsList) && existsList.length > 0) {
        console.log(`id: ${obj.id} had existsed`);
        updateData.push(obj);
      } else {
        newData.push(obj);
      }
    }

    if(newData.length > 0) {
      console.log('insert new data of: ', newData.length);
      try {
        let result = await this.db.insertMany(newData);
        result && this.Event.emit('finished');
      } catch (error) {
        console.log('--inser error-', error);
        await this.dupkeyDataResolve(newData);
      }
    }
    if(updateData.length > 0){
      console.log('....start update.....');
      for (const item of updateData) {
        const id = item.id;
        let result = await this.db.updateOne({id}, item);
        console.log(`update item of ${id}`, result);
      }
    }

    this.Event.emit('finished');
  }
  async dupkeyDataResolve(data = []) {
    if(Array.isArray(data)) {
      for (const item of data) {
        const thumb = item.thumb;
        const isExists = await this.db.find({ thumb });
        if(isExists) {
          await this.db.updateOne({thumb}, item);
        } else {
          await this.db.insertOne(item);
        }
      }
    }
  }
}

// const url = "https://wallhaven.cc/hot?page=1";
const url = `https://wallhaven.cc/latest?page=1`;
// const url = 'https://wallhaven.cc/toplist?page=1';

const spider = new Spider({url});
spider.init();

