const path = require('path');
const fs = require('fs');
const cherrio = require( 'cheerio');
const request = require('request-promise');
// const request = require('request');
const MongoClient = require('./mongo');
const EventEmitter = require('events');

const inquirer = require('inquirer');
const chalk = require('chalk');
const Ora = require('ora');


class DownloadWallhavenBigImage {
  constructor({ count, tag, path}) {
    this.count = count;
    this.tag = tag;
    this.path = path;
    this.query= { tag: { $eq: this.tag }};

    this.total = 0;
    this.page = {
      pageIndex: 0,
      pageSize: 100
    };
    this.dataList = [];

    this.Event = new EventEmitter();
    this.db = new MongoClient();
    this.spinner = new Ora();

    this.Event.on('finished', () => {
      console.log('--finished--');
      this.disconnect();
      this.spinner.succeed();
      process.exit(1);
    });
  }

  async start() {
    this.total = await this.db.countDocuments(this.query);
    console.log('db data count:', this.total);

    await this.loop();
  }

  async loop() {
    let currentCount = this.page.pageIndex * this.page.pageSize;
    if(currentCount <= this.total || currentCount < this.count) {
      this.page.pageIndex++;
      await this.getList();
      await this.disposeList();
    } else{
      this.spinner.text = 'current count is ' + currentCount + ', finished';
      await this.disconnect();
      process.exit(1);
    }

  }

  async getList() {
    this.spinner.start();
    this.spinner.text = 'start get data form db...';

    let data = await this.getDataListFromDb();
    console.log('data:', JSON.stringify(data));
    if(Array.isArray(data)) {
      this.dataList = data;
    }
  }

  getDataListFromDb() {
    return new Promise(( resolve, reject ) => {
      const query = {};
      this.tag && (query.tag = { $eq: this.tag});
      let currentCount = this.page.pageIndex * this.page.pageSize;

      this.db.Thumb
        .find(query)
        .skip(currentCount)
        .limit(this.pageSize)
        .exec((err, data) => {
          if(err) {
            console.error(`get datalist error in pageSize: ${this.page.pageSize}, pageIndex: ${this.page.pageIndex}: `, err);
            reject(err);
          }
          console.log(`get datalist from db of pagesize: ${this.page.pageSize}, pageIndex" ${this.page.pageIndex}`, data.length);
          resolve(data);
        });
    });
  }

  async disposeList() {
    for(let item of this.dataList) {
      this.spinner.start('start dispose item, current item: ' + item._id);
      await this.disposeItem();
    }
    this.spinner.start('next loop start....');
    this.loop();
  }

  async disposeItem() {
    this.current = this.dataList.shift();
    console.log('disposeItem, current id', this.current._id, this.current.fullSrc);
    try {
      let data = await this.loadHtml(this.current.fullSrc);
      const { full, width, height } = data;
      const arr = full.split('/');
      const fileEnd = arr[arr.length - 1].replace(/[\s\S]*\-/, '');
      const filename = `${width}x${height}-${fileEnd}`;
      const filepath = path.join(this.path, filename);

      this.updateHandler(data);
      this.loadFile(full, filepath);
      await this.awaitCall(() => {}, 3000);
    } catch (error) {
      console.error('load html error');
    }
  }

  async loadHtml(url) {
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

    return new Promise((resolve, reject) => {
      request(options)
        .then(htmlString => {
          let dataParsed = this.parseFullThumb(htmlString);
          resolve(dataParsed);
        }).catch(err => {
          console.error('requet error:');
          reject(err);
        });

    });

  }

  // 报错处理
  parseFullThumb(html) {
    try {
      const $ = cherrio.load(html);
      const dom = $('#wallpaper');
      const src = $(dom).attr('src');
      const id = $(dom).attr('data-wallpaper-id');
      const width = $(dom).attr('data-wallpaper-height');
      const height = $(dom).attr('data-wallpaper-width');

      const itemData = {
        id: id,
        full: src,
        width: width,
        height: height
      };

      return itemData;
    } catch (error) {
      return;
    }
  }

  /**
  * @param src 数据
  * @param filepath 存储路径
  */
  loadFile(url, filepath) {
    const isFileExists = fs.existsSync(filepath);
    if(!isFileExists) {
      this.spinner.start();
      this.spinner.text = `download image... ${url}, ${filepath}`;
      request.get({
        url,
        headers: {
          "Keep-Alive": "max=5000"
        }
      })
        .on('error', (err) => {
          console.error('load file error:', err);
        })
        .pipe(fs.createWriteStream(filepath))
        .on('close', () => {
          console.log(chalk.blue(`download file ended: ${url}, ${filepath}`));
          this.spinner.text = `download image ended... ${url}, ${filepath}`;
          this.spinner.succeed();
        });
    } else {
      console.log('file exists:', filepath);
    }
  }

  updateHandler(item) {
    if(item.id && item.full) {
      this.spinner.start('update item: ' + JSON.stringify(item) + '...');

      this.db.Thumb
        .updateOne({id: { $eq: item.id }}, { full: item.full })
        .exec((err, result) => {
          if(err) {
            console.error('--update err --', err);
            this.spinner.failed('update item failed' + err);
          }
          console.error('--update src --', result);
          this.spinner.succeed('update item succeed');
        });
    }
  }

  awaitCall (cb, timeout = 300) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(cb);
      }, timeout);
    });
  }

  async disconnect() {
    this.spinner.start('disconnect mongodb....');
    await this.db.close();
    this.spinner.succeed('disconnect mongodb ended....');
  }
}

async function parseArgs() {
  const questions = [
    {
      name: 'count',
      type: 'input',
      message: 'Please input a count, eg: how many images to download: \n ',
      validate: (val) => {
        if(/\D+/g.test(val)) {
          console.log(chalk.red('you need to provide a number type'));
          return false;
        } else {
          return true;
        }
      }
    },
    {
      name: 'path',
      type: 'list',
      message: 'Please select download file save path:',
      choices: [
        '/mnt/e/images/wallhaven',
        '/Users/mhy/Pictures/spider',
        '/Users/mahy/Pictures/spider'
      ]
    },
    {
      name: 'tag',
      type: 'list',
      message: 'Please select a tag to download',
      choices: ['toplist', 'latest', 'hot']
    }
  ];
  let answers = await inquirer.prompt(questions);
  return answers;
}

async function start() {
  const { path, tag, count } = await parseArgs();
  if(!fs.existsSync(path)) {
    let makeDirConfim = await inquirer.prompt({
      name: 'makeDirConfim',
      type: 'confirm',
      message: `the path is not exists, exec "mkdir ${path}" now ?`,
      default: false
    });

    if(makeDirConfim) {
      fs.mkdirSync(path, { recursive: true });
    } else {
      process.exit(1);
    }
  }

  let download = new DownloadWallhavenBigImage({ count, tag, path });
  download.start();
}

start();