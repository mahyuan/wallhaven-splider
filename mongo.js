const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// const ObjectId = Schema.ObjectId;

class MongoDb {
  constructor() {
    require('./loadenv')();
    // 'mongodb://{user}:{password}@{host}:{port}/{dbname}'
    // 'mongodb://localhost:27017/wallhaven'
    const url = this.getDBUrl();
    const options = { useNewUrlParser: true , useUnifiedTopology: true};
    this.db = mongoose.connect(url, options);
    this.Thumb = null;
    this.initModel();
  }
  getDBUrl() {
    const isAuth = process.env.DB_AUTH;
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const pwd = process.env.DB_PWD;
    const port = process.env.DB_PORT;
    const dbname = process.env.DB_NAME;
    const authPrefix = isAuth ? `${user}:${pwd}@` : '';
    // 'mongodb://{user}:{password}@{host}:{port}/{dbname}'
    return `mongodb://${authPrefix}${host}:${port}/${dbname}`;
  }

  initModel() {
    const thumbSchema = new Schema({
      id: String,
      tag: String,
      thumb:   String,
      full: String,
      fullSrc: String,
      fullThumb: String,
      like: { type: Number, default: 0},
      width: { type: Number, default: 0},
      height: { type: Number, default: 0},
      created: { type: Date, default: Date.now },
      updated: { type: Date, default: Date.now },
    });

    // 使用pre middleware 更新时间
    thumbSchema.pre('updateOne', async function() {
      this.set({ 'updated': Date.now() });
    });
    this.Thumb = mongoose.model('Thumb', thumbSchema, 'thumb');
  }
  async insertMany(data) {
    if(Array.isArray(data)) {
      return await this.Thumb.insertMany(data);
    } else {
      return await this.Thumb.create(data);
    }
  }

  async insertOne(data) {
    return await this.Thumb.insertOne(data);
  }


  async find(filter = {}) {
    return await this.Thumb.find(filter).exec();
  }

  async updateOne(filter, data) {
    return await this.Thumb.updateOne(filter, data);
  }

  async remove(filter) {
    return await this.Thumb.remove(filter);
  }
}

module.exports = MongoDb;
